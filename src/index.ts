import { WAConnection } from '@adiwajshing/baileys'
import * as fs from 'fs'

/**
 * If no chats-received event will be received during this number seconds
 * it will stop listen and write the contacts
 */
let receiveDebounceTime = 10

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv))
  .alias('v', 'version')
  .alias('h', 'help')
  .usage(
    'Gets WhatsApp contact list from Web version\nUsage: $0 --save-credentials --time [seconds]'
  )
  .option('save-credentials', {
    alias: 'c',
    type: 'boolean',
    default: false,
    description:
      'Saves credentials and uses them. Eliminate need to use QR code every time',
  })
  .option('time', {
    alias: 't',
    type: 'number',
    default: 5,
    description:
      'Time (in seconds) of waiting and listening for new data before write the contacts',
  }).argv

let startedTime = process.hrtime()
let timer: NodeJS.Timeout | null = null
const events = require('events')
const EventEmitter = new events.EventEmitter()

;(async () => {
  const connection = new WAConnection()
  connection.logger.level = 'warn'

  if (argv.c || argv['save-credentials']) {
    fs.existsSync('./credentials.json') &&
      connection.loadAuthInfo('./credentials.json')

    connection.on('credentials-updated', () => {
      console.log(`credentials updated`)
      const authInfo = connection.base64EncodedAuthInfo()
      fs.writeFileSync(
        './credentials.json',
        JSON.stringify(authInfo, null, '\t')
      )
    })
  }

  if (typeof argv.t !== 'undefined' || typeof argv.time !== 'undefined') {
    //@ts-ignore
    receiveDebounceTime =
      typeof argv.t === 'undefined' || isNaN(argv.t)
        ? typeof argv.time !== 'undefined' &&
          !isNaN(argv.time) &&
          Number(argv.time)
        : Number(argv.t)
  }

  connection.on('chats-received', () => {
    console.log('receiving contacts...')
    if (timer) {
      const oldTimer = timer
      clearTimeout(oldTimer)
    }
    timer = setTimeout(() => {
      EventEmitter.emit('GWC: save-contacts', connection)
    }, receiveDebounceTime * 1000)
  })
  connection.on('close', ({ reason, isReconnecting }) =>
    console.log(`disconnected: ${reason}`)
  )

  EventEmitter.on('GWC: save-contacts', (connection: WAConnection) => {
    console.log('contacts received')
    const contactNumbers = connection.chats
      .all()
      .map((chat) => {
        const match = /^(\d+)@/g.exec(chat.jid)
        if (match) {
          return `+${match[1]}`
        }
      })
      .filter(Boolean)

    fs.writeFileSync('contacts.txt', contactNumbers.join('\n'))
    console.log(`contacts written: ${contactNumbers.length}`)
    process.exit()
  })

  await connection.connect()
  console.log(`connected: ${connection.user.name} (${connection.user.jid})`)
})()
