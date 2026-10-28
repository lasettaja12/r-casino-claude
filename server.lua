local Account = Config.Account
local casesById = {}
local players = {}
local crashHistory = {}

local vipGroups = {}
for _, g in ipairs(Config.VipGroups) do vipGroups[g] = true end

local function P(src)
    players[src] = players[src] or {}
    return players[src]
end

AddEventHandler('playerDropped', function() players[source] = nil end)

CreateThread(function()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `casino_history` (
            `id` INT NOT NULL AUTO_INCREMENT,
            `identifier` VARCHAR(64) NOT NULL,
            `game` VARCHAR(16) NOT NULL,
            `title` VARCHAR(64) NOT NULL,
            `bet` INT NOT NULL DEFAULT 0,
            `profit` INT NOT NULL DEFAULT 0,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            INDEX `identifier` (`identifier`)
        )
    ]])
end)

local function fmt(n)
    local s = tostring(math.floor(n))
    local out = s:reverse():gsub('(%d%d%d)', '%1,'):reverse()
    return (out:gsub('^(-?),', '%1'))
end

local function fmtMult(m)
    local s = ('%.2f'):format(m):gsub('0+$', ''):gsub('%.$', '')
    return s .. 'x'
end

local function rarityFor(chance)
    if chance >= 40 then return 'common' end
    if chance >= 20 then return 'rare' end
    if chance >= 8 then return 'epic' end
    return 'legendary'
end

local function setupItem(it)
    local kind, a, b = it[1], it[2], it[3]
    it.type = kind
    if kind == 'money' then
        it.amount = a
        it.label = it.label or ('$%s Cash'):format(fmt(a))
        it.value = it.value or a
        it.image = it.image or 'img/cash.png'
    elseif kind == 'armour' then
        it.amount = a or 100
        it.label = it.label or 'Body Armor'
        it.value = it.value or 300
        it.image = it.image or 'img/armor.png'
    elseif kind == 'weapon' then
        it.name = a
        it.label = it.label or a
        it.image = it.image or ('img/weapons/%s.png'):format(a)
    elseif kind == 'item' then
        it.name, it.amount = a, b or 1
        it.label = it.label or a
    elseif kind == 'vehicle' then
        it.model = a
        it.label = it.label or a
        it.image = it.image or 'img/car.png'
    else
        print(('^3[freedom_casino] outo palkinto "%s", tarkista config^7'):format(tostring(kind)))
    end
    it.value = it.value or 0
    it.weight = it.chance or 1
    it.rarity = it.rarity or rarityFor(it.weight)
end

for _, c in ipairs(Config.Cases) do
    c.totalWeight = 0
    for _, it in ipairs(c.items) do
        setupItem(it)
        c.totalWeight = c.totalWeight + it.weight
    end
    casesById[c.id] = c
end

local function balance(x) return x.getAccount(Account).money end

local function fail(msg) return { ok = false, error = msg } end

local function takeBet(x, amount)
    amount = math.floor(tonumber(amount) or 0)
    if amount < Config.MinBet or amount > Config.MaxBet then
        return nil, ('Bet must be between %s and %s.'):format(fmt(Config.MinBet), fmt(Config.MaxBet))
    end
    if balance(x) < amount then return nil, 'Not enough coins.' end
    x.removeAccountMoney(Account, amount, 'casino-bet')
    return amount
end

local function pay(x, amount, reason)
    if amount > 0 then x.addAccountMoney(Account, math.floor(amount), reason or 'casino-win') end
end

local function log(x, game, title, bet, profit)
    MySQL.insert('INSERT INTO casino_history (identifier, game, title, bet, profit) VALUES (?, ?, ?, ?, ?)',
        { x.identifier, game, title, math.floor(bet), math.floor(profit) })
    return { game = game, title = title, bet = math.floor(bet), profit = math.floor(profit), ts = os.time() }
end

local function register(name, fn)
    lib.callback.register('freedom_casino:' .. name, function(src, data)
        local x = ESX.GetPlayerFromId(src)
        if not x then return fail('Player not loaded.') end
        local ok, res = pcall(fn, src, x, type(data) == 'table' and data or {})
        if not ok then
            print(('^1[freedom_casino] %s: %s^7'):format(name, res))
            return fail('Something went wrong. Try again.')
        end
        return res
    end)
end

local function toNui(src, msg) TriggerClientEvent('freedom_casino:nui', src, msg) end

local function cooldownKey(identifier, caseId) return ('cd:%s:%s'):format(caseId, identifier) end

local function cooldownLeft(identifier, c)
    if not c.cooldownHours then return 0 end
    local left = GetResourceKvpInt(cooldownKey(identifier, c.id)) + c.cooldownHours * 3600 - os.time()
    return left > 0 and left or 0
end

local function isVip(x) return vipGroups[x.getGroup()] == true end

local function fmtLeft(sec)
    return ('%dh %dm'):format(math.floor(sec / 3600), math.floor(sec % 3600 / 60))
end

local function caseLock(x, c)
    if c.vip and not isVip(x) then return 'This case is for VIP players only.' end
    local left = cooldownLeft(x.identifier, c)
    if left > 0 then return ('Available again in %s.'):format(fmtLeft(left)) end
end

local function publicCases(x)
    local list = {}
    for _, c in ipairs(Config.Cases) do
        local items = {}
        for i, it in ipairs(c.items) do
            items[i] = { label = it.label, rarity = it.rarity, image = it.image,
                chance = math.floor(it.weight / c.totalWeight * 1000 + 0.5) / 10 }
        end
        local reason = caseLock(x, c)
        list[#list + 1] = {
            id = c.id, label = c.label, price = c.price, items = items, vip = c.vip or nil,
            cooldown = c.cooldownHours and ('%dh cooldown'):format(c.cooldownHours) or nil,
            locked = reason ~= nil, lockReason = reason,
        }
    end
    return list
end

local function newPlate()
    local chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
    for _ = 1, 20 do
        local p = 'CAS'
        for _ = 1, 5 do
            local i = math.random(#chars)
            p = p .. chars:sub(i, i)
        end
        if not MySQL.scalar.await('SELECT 1 FROM owned_vehicles WHERE plate = ?', { p }) then return p end
    end
end

local function giveReward(src, x, it)
    if it.type == 'money' then
        pay(x, it.amount, 'casino-case')
    elseif it.type == 'weapon' then
        x.addWeapon(it.name, it.ammo or 100)
    elseif it.type == 'item' then
        x.addInventoryItem(it.name, it.amount or 1)
    elseif it.type == 'armour' then
        TriggerClientEvent('freedom_casino:armour', src, it.amount or 100)
    elseif it.type == 'vehicle' then
        local plate = newPlate()
        if not plate then return false end
        MySQL.insert.await('INSERT INTO owned_vehicles (owner, plate, vehicle, type, job, stored) VALUES (?, ?, ?, ?, ?, 1)', {
            x.identifier, plate, json.encode({ model = GetHashKey(it.model), plate = plate }), 'car', 'civ',
        })
    end
    return true
end

local function roll(c)
    local r = math.random() * c.totalWeight
    for i, it in ipairs(c.items) do
        r = r - it.weight
        if r <= 0 then return i end
    end
    return #c.items
end

register('openCase', function(src, x, d)
    local c = casesById[d.id]
    if not c then return fail('Unknown case.') end
    local p = P(src)
    if p.busy then return fail('Wait for the current case to finish.') end
    local reason = caseLock(x, c)
    if reason then return fail(reason) end
    if balance(x) < c.price then return fail('Not enough coins.') end

    p.busy = true
    x.removeAccountMoney(Account, c.price, 'casino-case')
    if c.cooldownHours then SetResourceKvpInt(cooldownKey(x.identifier, c.id), os.time()) end

    local index = roll(c)
    local it = c.items[index]
    local ok = giveReward(src, x, it)
    if not ok then
        pay(x, c.price, 'casino-refund')
        p.busy = false
        return fail('Could not give the reward. Your coins were refunded.')
    end
    local entry = log(x, 'cases', it.label, c.price, (it.value or 0) - c.price)
    SetTimeout(5500, function() if players[src] then players[src].busy = false end end)

    return { ok = true, index = index - 1, balance = balance(x), entry = entry, cases = publicCases(x) }
end)

register('coinflip', function(src, x, d)
    local bet, err = takeBet(x, d.bet)
    if not bet then return fail(err) end
    local win = math.random() * 100 < Config.Coinflip.winChance
    if win then pay(x, bet * 2, 'casino-coinflip') end
    local profit = win and bet or -bet
    return { ok = true, win = win, profit = profit, balance = balance(x),
        entry = log(x, 'coinflip', win and 'Win' or 'Loss', bet, profit) }
end)

local function minesMult(m, k)
    if k == 0 then return 1 end
    local mult = 1
    for i = 0, k - 1 do mult = mult * (25 - i) / (25 - m - i) end
    return math.max(1, math.floor(mult * (1 - Config.Mines.houseEdge / 100) * 100) / 100)
end

local function mineList(g)
    local list = {}
    for i in pairs(g.mines) do list[#list + 1] = i end
    return list
end

local function minesCashout(x, p)
    local g = p.mines
    p.mines = nil
    local mult = minesMult(g.count, g.revealedCount)
    local payout = math.floor(g.bet * mult)
    pay(x, payout, 'casino-mines')
    return { ok = true, cashed = true, multiplier = mult, payout = payout, profit = payout - g.bet,
        mines = mineList(g), balance = balance(x), entry = log(x, 'mines', fmtMult(mult), g.bet, payout - g.bet) }
end

register('minesStart', function(src, x, d)
    local p = P(src)
    if p.mines then return fail('Finish your current game first.') end
    local count = math.floor(tonumber(d.mines) or 0)
    if count < 1 or count > 24 then return fail('Pick between 1 and 24 mines.') end
    local bet, err = takeBet(x, d.bet)
    if not bet then return fail(err) end

    local tiles = {}
    for i = 0, 24 do tiles[#tiles + 1] = i end
    for i = #tiles, 2, -1 do
        local j = math.random(i)
        tiles[i], tiles[j] = tiles[j], tiles[i]
    end
    local mines = {}
    for i = 1, count do mines[tiles[i]] = true end

    p.mines = { bet = bet, count = count, mines = mines, revealed = {}, revealedCount = 0 }
    return { ok = true, balance = balance(x) }
end)

register('minesReveal', function(src, x, d)
    local p = P(src)
    local g = p.mines
    if not g then return fail('Start a game first.') end
    local idx = math.floor(tonumber(d.tile) or -1)
    if idx < 0 or idx > 24 or g.revealed[idx] then return fail('Pick another tile.') end

    if g.mines[idx] then
        p.mines = nil
        return { ok = true, mine = true, tile = idx, mines = mineList(g), profit = -g.bet,
            balance = balance(x), entry = log(x, 'mines', 'Mine', g.bet, -g.bet) }
    end

    g.revealed[idx] = true
    g.revealedCount = g.revealedCount + 1
    if g.revealedCount == 25 - g.count then
        local res = minesCashout(x, p)
        res.tile = idx
        return res
    end
    local mult = minesMult(g.count, g.revealedCount)
    return { ok = true, mine = false, tile = idx, multiplier = mult,
        next = minesMult(g.count, g.revealedCount + 1), profit = math.floor(g.bet * mult) - g.bet }
end)

register('minesCashout', function(src, x)
    local p = P(src)
    if not p.mines or p.mines.revealedCount == 0 then return fail('Reveal at least one tile first.') end
    return minesCashout(x, p)
end)

local K = Config.Crash.speed
local function msFor(m) return math.log(m) / K * 1000 end
local function multAt(ms) return math.floor(math.exp(K * ms / 1000) * 100) / 100 end

-- crash-kohta arvotaan heti alussa, clientti ei tiiä siitä mitään ennen ku se tapahtuu
local function crashPoint()
    if math.random() * 100 < Config.Crash.instantCrash then return 1.0 end
    local cp = math.floor((1 - Config.Crash.houseEdge / 100) / (1 - math.random()) * 100) / 100
    return math.max(1.01, math.min(cp, Config.Crash.max))
end

local function crashSettle(x, g, m)
    g.active = false
    local payout = math.floor(g.bet * m)
    pay(x, payout, 'casino-crash')
    return { ok = true, event = 'cashed', multiplier = m, payout = payout, profit = payout - g.bet,
        balance = balance(x), entry = log(x, 'crash', fmtMult(m), g.bet, payout - g.bet) }
end

register('crashStart', function(src, x, d)
    local p = P(src)
    if p.crash then return fail('Wait for the current round to end.') end
    local auto = tonumber(d.auto)
    if auto and auto < 1.01 then auto = nil end
    local bet, err = takeBet(x, d.bet)
    if not bet then return fail(err) end

    local g = { bet = bet, point = crashPoint(), auto = auto, start = GetGameTimer(), active = true }
    p.crash = g

    SetTimeout(math.floor(msFor(g.point)), function()
        local pl = players[src]
        if not pl or pl.crash ~= g then return end
        pl.crash = nil
        table.insert(crashHistory, 1, g.point)
        if #crashHistory > 8 then crashHistory[9] = nil end
        local msg = { action = 'crash', event = 'crashed', point = g.point, history = crashHistory }
        if g.active then
            g.active = false
            local xp = ESX.GetPlayerFromId(src)
            if xp then
                msg.entry = log(xp, 'crash', fmtMult(g.point), g.bet, -g.bet)
                msg.balance = balance(xp)
            end
        end
        toNui(src, msg)
    end)

    if auto and auto < g.point then
        SetTimeout(math.floor(msFor(auto)), function()
            local xp = ESX.GetPlayerFromId(src)
            if not xp or not g.active then return end
            local res = crashSettle(xp, g, auto)
            res.action = 'crash'
            toNui(src, res)
        end)
    end

    return { ok = true, balance = balance(x) }
end)

register('crashCashout', function(src, x)
    local g = P(src).crash
    if not g or not g.active then return fail('No active bet.') end
    local m = multAt(GetGameTimer() - g.start)
    if m >= g.point then return fail('Too late, it crashed.') end
    return crashSettle(x, g, math.max(1, m))
end)

register('plinko', function(src, x, d)
    local rows = math.floor(tonumber(d.rows) or 0)
    local tbl = Config.Plinko[rows] and Config.Plinko[rows][d.risk]
    if not tbl then return fail('Pick a risk level and rows.') end
    local bet, err = takeBet(x, d.bet)
    if not bet then return fail(err) end

    local path, slot = {}, 0
    for i = 1, rows do
        path[i] = math.random(0, 1)
        slot = slot + path[i]
    end
    local mult = tbl[slot + 1]
    local payout = math.floor(bet * mult)
    pay(x, payout, 'casino-plinko')
    return { ok = true, path = path, slot = slot, multiplier = mult, profit = payout - bet,
        balance = balance(x), entry = log(x, 'plinko', fmtMult(mult), bet, payout - bet) }
end)

local RANKS = { 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K' }
local SUITS = { 'S', 'H', 'D', 'C' }

local function newDeck()
    local deck = {}
    for _, s in ipairs(SUITS) do
        for _, r in ipairs(RANKS) do deck[#deck + 1] = { r = r, s = s } end
    end
    for i = #deck, 2, -1 do
        local j = math.random(i)
        deck[i], deck[j] = deck[j], deck[i]
    end
    return deck
end

local function score(hand)
    local total, aces = 0, 0
    for _, c in ipairs(hand) do
        if c.r == 'A' then total, aces = total + 11, aces + 1
        elseif c.r == 'K' or c.r == 'Q' or c.r == 'J' then total = total + 10
        else total = total + tonumber(c.r) end
    end
    while total > 21 and aces > 0 do total, aces = total - 10, aces - 1 end
    return total
end

local function isBJ(hand) return #hand == 2 and score(hand) == 21 end

local function bjView(x, g, extra)
    local dealer = g.done and g.dealer or { g.dealer[1], { hidden = true } }
    local res = {
        ok = true, player = g.player, dealer = dealer, bet = g.bet,
        playerScore = score(g.player), dealerScore = score(g.done and g.dealer or { g.dealer[1] }),
        finished = g.done, canDouble = not g.done and #g.player == 2, balance = balance(x),
    }
    if extra then for k, v in pairs(extra) do res[k] = v end end
    return res
end

local function bjFinish(x, p, dealerPlays)
    local g = p.bj
    g.done = true
    p.bj = nil
    local ps = score(g.player)
    if dealerPlays and ps <= 21 and not isBJ(g.player) then
        while score(g.dealer) < 17 do g.dealer[#g.dealer + 1] = table.remove(g.deck) end
    end
    local ds = score(g.dealer)

    local title, payout
    if ps > 21 then title, payout = 'Bust!', 0
    elseif isBJ(g.player) and isBJ(g.dealer) then title, payout = 'Push', g.bet
    elseif isBJ(g.player) then title, payout = 'Blackjack!', math.floor(g.bet * 2.5)
    elseif isBJ(g.dealer) then title, payout = 'Loss', 0
    elseif ds > 21 or ps > ds then title, payout = 'Win', g.bet * 2
    elseif ps == ds then title, payout = 'Push', g.bet
    else title, payout = 'Loss', 0 end

    pay(x, payout, 'casino-blackjack')
    local profit = payout - g.bet
    return bjView(x, g, { result = title, profit = profit, entry = log(x, 'blackjack', title, g.bet, profit) })
end

register('bjDeal', function(src, x, d)
    local p = P(src)
    if p.bj then return fail('Finish your current hand first.') end
    local bet, err = takeBet(x, d.bet)
    if not bet then return fail(err) end
    local deck = newDeck()
    local g = { bet = bet, deck = deck, player = {}, dealer = {} }
    g.player[1] = table.remove(deck); g.dealer[1] = table.remove(deck)
    g.player[2] = table.remove(deck); g.dealer[2] = table.remove(deck)
    p.bj = g
    if isBJ(g.player) or isBJ(g.dealer) then return bjFinish(x, p, false) end
    return bjView(x, g)
end)

register('bjHit', function(src, x)
    local p = P(src)
    local g = p.bj
    if not g then return fail('Deal a new hand first.') end
    g.player[#g.player + 1] = table.remove(g.deck)
    local s = score(g.player)
    if s > 21 then return bjFinish(x, p, false) end
    if s == 21 then return bjFinish(x, p, true) end
    return bjView(x, g)
end)

register('bjStand', function(src, x)
    local p = P(src)
    if not p.bj then return fail('Deal a new hand first.') end
    return bjFinish(x, p, true)
end)

register('bjDouble', function(src, x)
    local p = P(src)
    local g = p.bj
    if not g then return fail('Deal a new hand first.') end
    if #g.player ~= 2 then return fail('You can only double on your first two cards.') end
    if balance(x) < g.bet then return fail('Not enough coins to double.') end
    x.removeAccountMoney(Account, g.bet, 'casino-bet')
    g.bet = g.bet * 2
    g.player[#g.player + 1] = table.remove(g.deck)
    return bjFinish(x, p, score(g.player) <= 21)
end)

register('getData', function(src, x)
    local recent = MySQL.query.await(
        'SELECT game, title, bet, profit, UNIX_TIMESTAMP(created_at) AS ts FROM casino_history WHERE identifier = ? ORDER BY id DESC LIMIT 150',
        { x.identifier }) or {}
    local plinko = {}
    for rows, tbl in pairs(Config.Plinko) do plinko[tostring(rows)] = tbl end
    return {
        ok = true, balance = balance(x), cases = publicCases(x), recent = recent,
        minBet = Config.MinBet, maxBet = Config.MaxBet, plinko = plinko, crashHistory = crashHistory,
        crashSpeed = Config.Crash.speed,
    }
end)

register('history', function(src, x)
    local stats = MySQL.query.await(
        'SELECT game, COUNT(*) AS n, COALESCE(SUM(bet), 0) AS wagered, COALESCE(SUM(profit), 0) AS net FROM casino_history WHERE identifier = ? GROUP BY game',
        { x.identifier }) or {}
    local list = MySQL.query.await(
        'SELECT game, title, bet, profit, UNIX_TIMESTAMP(created_at) AS ts FROM casino_history WHERE identifier = ? ORDER BY id DESC LIMIT 100',
        { x.identifier }) or {}
    return { ok = true, stats = stats, list = list, balance = balance(x) }
end)
