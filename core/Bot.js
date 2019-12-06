'use strict'

const Discord = require('discord.js')
const Song = require('./media/Song')
const Playlist = require('./media/Playlist')
const MediaPlayer = require('./MediaPlayer')

class Bot {
  constructor () {
    this.voice = {
      channel: null
    }
    this.text = {
      channel: null
    }
    this.connection = null
    this.client = new Discord.Client()
    this.config = {
      messageDelay: 15000
    }
    this.isConnecting = false

    this.mediaPlayer = new MediaPlayer()
    this.mediaPlayer.on('start', song => {
      this.message('Now playing: ' + song.title)
      this.setPlaying(song.title)
    })
    this.mediaPlayer.on('end', () => {
      let connectedMembers = this.client.voiceConnections.first().channel.members.array()
      console.log(connectedMembers)
      if (connectedMembers.length <= 1) {
        console.log('empty channel')
        this.message('Channel is empty, leaving...')
        this.stop()
      }
    })
    this.mediaPlayer.on('finished', () => {
      this.message('Queue is empty, leaving...')
      this.stop()
    })
  }

  join (id) {
    if (!this.voice.connection) {
      this.isConnecting = true
      if (!id) {
        return this.voice.channel.join()
      } else {
        this.voice.channel = this.client.channels.get(id)
        return this.voice.channel.join()
      }
    }
  }

  leave () {
    this.mediaPlayer.dumpQ()
    if (this.dispatcher) {
      this.dispatcher.end()
    }
    if (this.connection) {
      this.voice.channel.leave()
      this.connection = null
    } else {
      // check to see if it died
      const conns = this.client.voiceConnections.array()
      // console.log(conns);
      if (conns.length > 0) {
        for (var i = conns.length - 1; i >= 0; i--) {
          if (conns[i]) {
            conns[i].leave()
          }
        };
      }
    }
    this.setStatus('Overwatch') // well...
  }
  // a backwrapper in case you dont need any of the message options
  send (content, options) {
    this.text.channel.send(content, options)
  }
  message (m, options, callback) {
    this.text.channel.send(m).then(message => {
      if (typeof callback === 'function') {
        callback(message)
      }
      let delay = (options ? (options.messageDelay || this.config.messageDelay) : this.config.messageDelay)
      if (delay > 0) {
        message.delete(delay)
      }
    }).catch(console.error)
  }

  _ensureConnectionAfterRequest () {
    if (!this.connection && !this.isConnecting) {
      console.log('No connection, connecting...')

      this.join().then(conn => {
        this.connection = conn
        this.isConnecting = false
        this.mediaPlayer.provideConnection(conn)
        this.mediaPlayer.play()
      }).catch(e => {
        console.error(e)
        this.leave()
      })
    } else {
      // var latest = this.queue.peekLast()
      // do something...
    }
  }

  play (input) {
    if (input instanceof Song || input instanceof Playlist) {
      if (input instanceof Song) {
        this.message('Added ' + input.title + ' to queue at position ' + parseInt(this.mediaPlayer.getQueueLength() + 1))
        this.mediaPlayer.enqueue(input)
      } else if (input instanceof Playlist) {
        this.message('Adding playlist to queue...')
        this.mediaPlayer.enqueue(input)
      }
      this._ensureConnectionAfterRequest()
    } else {
      throw new TypeError('Item passed to play was an instance of ' + input.constructor.name)
    }
  }
  stop () {
    this.mediaPlayer.stop()
    this.leave()
  }
  skip () {
    this.mediaPlayer.skip()
  }
  returnQueue () {
    if (this.mediaPlayer.isQueueEmpty()) {
      return null
    }
    return this.mediaPlayer.returnQueue()
  }
  bump (songIndex) {
    let t = parseInt(songIndex)
    if (!isNaN(t) && t > 0) {
      let res = this.mediaPlayer.bump(t)
      if (res !== false && res instanceof Song) {
        this.message('Bumped ' + res.title + ' to front of queue')
      } else {
        this.message('No song found at index `' + t + '`')
      }
    } else {
      this.message('Invalid song index provided')
    }
  }
  removeFromQueue (songIndex) {
    let t = parseInt(songIndex)
    if (!isNaN(t) && t > 0) {
      let res = this.mediaPlayer.removeFromQueue(t)
      if (res !== false && res instanceof Song) {
        this.message('Removed ***' + res.title + '*** from the queue')
      } else {
        this.message('No song found at index `' + t + '`')
      }
    } else {
      this.message('Invalid song index provided')
    }
  }
  shuffle () {
    this.mediaPlayer.shuffle()
  }
  setPlaying (status) {
    this.client.user.setPresence({
      status: 'online',
      afk: false,
      game: {
        name: status,
        url: 'http://www.twitch.tv/.',
        type: 0
      }
    })
  }
  setStatus (status) {
    this.client.user.setPresence({
      status: 'online',
      afk: false,
      game: {
        name: status,
        // url: 'http://www.twitch.tv/.',
        type: 0
      }
    })
  }
  setVoiceChannel (chanID) {
    this.voice.channel = this.client.channels.get(chanID)
  }
  setTextChannel (chanID) {
    this.text.channel = this.client.channels.get(chanID)
  }
  setMessageDeleteDelay (i) {
    if (!isNaN(parseInt(i))) {
      this.config.messageDelay = parseInt(i)
      return true
    }
    return false
  }
  login (token) {
    this.client.login(token)
  }
}

module.exports = Bot
