fx_version 'cerulean'
game 'common'
name 'lumo_test'
description 'End-to-end checks for Lumo against a real MariaDB'

shared_script '@ox_lib/init.lua'
server_script 'server.lua'

dependencies { 'ox_lib', 'lumo' }
