local isOpen = false

local function close()
    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

RegisterCommand(Config.Command, function()
    if isOpen then return end
    local data = lib.callback.await('freedom_casino:getData', false)
    if not data or not data.ok then return end
    isOpen = true
    SetNuiFocus(true, true)
    data.action = 'open'
    SendNUIMessage(data)
end, false)

RegisterNUICallback('close', function(_, cb)
    close()
    cb({})
end)

RegisterNUICallback('call', function(body, cb)
    if type(body) ~= 'table' or type(body.fn) ~= 'string' then return cb({ ok = false, error = 'Bad request.' }) end
    cb(lib.callback.await('freedom_casino:' .. body.fn, false, body.data) or { ok = false, error = 'Server did not respond.' })
end)

RegisterNetEvent('freedom_casino:nui', function(msg)
    SendNUIMessage(msg)
end)

RegisterNetEvent('freedom_casino:armour', function(amount)
    SetPedArmour(PlayerPedId(), math.min(100, GetPedArmour(PlayerPedId()) + (amount or 100)))
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() and isOpen then SetNuiFocus(false, false) end
end)
