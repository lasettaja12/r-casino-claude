fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'freedom_casino'
description 'Freedom casino (/casino)'

dependencies { 'es_extended', 'ox_lib', 'oxmysql' }

shared_scripts {
    '@es_extended/imports.lua',
    '@ox_lib/init.lua',
    'config.lua',
}

client_script 'client.lua'
server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server.lua',
}

ui_page 'html/index.html'
files {
    'html/index.html',
    'html/app.js',
    'html/style.css',
    'html/img/*.png',
    'html/img/weapons/*.png',
}
