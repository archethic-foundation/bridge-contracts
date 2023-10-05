#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import deploy_pool from './commands/pool_management/deploy_pool.js'
import deploy_factory from './commands/pool_management/deploy_factory.js'
import update_pool from './commands/pool_management/update_pool.js'

import deploy_chargeable_htlc from './commands/test/deploy_chargeable_htlc.js'
import deploy_signed_htlc from './commands/test/deploy_signed_htlc.js'
import reveal_secret from './commands/test/reveal_secret.js'
import provision_htlc from './commands/test/provision_htlc.js'
import request_secret from './commands/test/request_secret.js'

const y = yargs(hideBin(process.argv))

y.command(deploy_pool).help()
y.command(deploy_factory).help()
y.command(update_pool).help()

y.command(deploy_chargeable_htlc).help()
y.command(deploy_signed_htlc).help()
y.command(reveal_secret).help()
y.command(provision_htlc).help()
y.command(request_secret).help()

y.parse()
