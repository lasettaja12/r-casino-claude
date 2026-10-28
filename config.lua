Config = {}

Config.Command = 'casino'
Config.Account = 'money'   -- 'money' = käteinen, 'bank' = pankki
Config.MinBet = 100
Config.MaxBet = 10000

Config.VipGroups = { 'vip', 'admin', 'superadmin' }

Config.Coinflip = { winChance = 50 }
Config.Mines = { houseEdge = 3 }
Config.Crash = { houseEdge = 3, instantCrash = 3, speed = 0.08, max = 1000 }

-- plinkon kertoimet, älä sörki jos et tiiä mitä teet
Config.Plinko = {
    [8] = {
        low    = { 5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6 },
        medium = { 13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13 },
        high   = { 29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29 },
    },
    [10] = {
        low    = { 8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9 },
        medium = { 22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22 },
        high   = { 76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76 },
    },
    [12] = {
        low    = { 10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10 },
        medium = { 33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33 },
        high   = { 170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170 },
    },
}

--[[
    keissin palkinnot:
      { 'money', 5000 }
      { 'armour', 100 }
      { 'weapon', 'WEAPON_PISTOL', label = 'Pistol', ammo = 60 }
      { 'item', 'bread', 5, label = 'Leipä' }
      { 'vehicle', 'adder', label = 'Adder' }

    chance = todnäk prosentteina, rarity tulee siitä ite jos ei laita
    (common / rare / epic / legendary). kuvat tulee automaattisesti,
    aseille img/weapons/NIMI.png, muille image = 'img/jotain.png'
]]
Config.Cases = {
    {
        id = 'starter', label = 'Starter Case', price = 250,
        items = {
            { 'money', 150,  chance = 50 },
            { 'armour', 100, chance = 35 },
            { 'money', 750,  chance = 12 },
            { 'money', 2500, chance = 3 },
        },
    },
    {
        id = 'weapon', label = 'Weapon Case', price = 500,
        items = {
            { 'weapon', 'WEAPON_KNIFE',        label = 'Knife',         chance = 50, value = 250 },
            { 'weapon', 'WEAPON_PISTOL',       label = 'Pistol',        chance = 35, value = 600,  ammo = 60 },
            { 'weapon', 'WEAPON_SMG',          label = 'SMG',           chance = 12, value = 1500, ammo = 120 },
            { 'weapon', 'WEAPON_CARBINERIFLE', label = 'Carbine Rifle', chance = 3,  value = 5000, ammo = 120 },
        },
    },
    {
        id = 'highroller', label = 'High Roller Case', price = 2500,
        vip = true, cooldownHours = 24,
        items = {
            { 'armour', 100,     chance = 50 },
            { 'money', 5000,     chance = 35 },
            { 'money', 25000,    chance = 12 },
            { 'vehicle', 'adder', label = 'Adder', chance = 3, value = 100000 },
        },
    },
}
