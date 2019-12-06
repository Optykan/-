const Command = require('./Command')
const PriorityQueue = require('./PriorityQueue')
// const FatalError = require('./ext/FatalError')

class CommandDelegator {
  constructor (injectables) {
    this.commands = new PriorityQueue()
    this.injectables = injectables
    this.verbose = true
  }

  setPrefix (prefix) {
    this.prefix = prefix
  }

  addInjectable (key, value) {
    this.injectables[key] = value
  }

  getInjectable (key) {
    return this.injectables[key]
  }

  // enableTrigger (trigger, state) {
  //   for (let i = 0; i < this.commands.length; i++) {
  //     if (this.commands[i].trigger.toLowerCase() === trigger.toLowerCase()) {
  //       this.commands[i].enabled = state
  //       return true
  //     }
  //   }
  //   return false
  // }

  _registerTrigger (trigger, action, injects, help, enabled, context, priority) {
    if (this.verbose) {
      console.log('Debug info for: ' + trigger)
      console.log('    Action   : ' + (context ? context.constructor.name : 'window') + '@' + action.name)
      console.log('    Injects  : ' + injects)
      console.log('    Help     : ' + help)
      console.log('    Context  : ' + (context ? context.constructor.name : 'window'))
      console.log('    Priority : ' + priority)
    }
    if (trigger.length < 1) {
      throw new TypeError('Plugin trigger cannot be empty')
    } else if (typeof trigger === 'string' && trigger.search(' ') !== -1) {
      throw new TypeError('Plugin trigger cannot contain spaces')
    } else if (typeof action !== 'function') {
      throw new TypeError('Trigger action must be a function, ' + typeof action + ' given')
    } else if (!this.isTriggerRegistered(trigger)) {
      this.commands.push(new Command(trigger, action, injects, help, enabled, context), priority)
    } else if (trigger === '*') {
      this.commands.push(new Command(trigger, action, injects, help, enabled, context), priority)
    } else {
      throw new Error('Trigger ' + trigger + ' already registered')
    }
  }

  registerPluginHook (trigger, action, injects, help, enabled, context, priority) {
    // called by init.js in /plugins
    // where injects is of format thingToInject@paramName
    var commandPriority = 10
    if (typeof trigger === 'object' && typeof action === 'object' && typeof injects === 'object' && trigger.length === action.length && action.length === injects.length) {
      for (let i = 0; i < trigger.length; i++) {
        if (Array.isArray(priority) && typeof priority[i] !== 'undefined') {
          commandPriority = priority[i]
        }
        if (typeof help === 'string') {
          this._registerTrigger(trigger[i], action[i], injects[i], help, enabled, context, commandPriority)
        } else if (Array.isArray(help)) {
          this._registerTrigger(trigger[i], action[i], injects[i], help[i], enabled, context, commandPriority)
        } else if (typeof help === 'object' && help[trigger[i]]) {
          this._registerTrigger(trigger[i], action[i], injects[i], help[trigger[i]], enabled, context, commandPriority)
        } else {
          throw new Error('Something went wrong in your plugin definition. Check your register method and try again. Maybe your help text doesn\'t match its trigger?')
        }
      }
    } else {
      this._registerTrigger(trigger, action, injects, help, enabled, context, commandPriority)
    }
  }

  parseIncomingMessage (tzuyu, message) {
    let request = this.resolveParamsFromMessage(message.content)
    if (request !== false) {
      tzuyu.setTextChannel(message.channel.id)
      this.delegateCommand(request.command, request.params)
    } else {
      // do nothing because its not a command
    }
  }

  _nextCommand (callback) {
    let command = this.commands.next()
    if (command) {
      callback(command)
    } else {
      this.commands.done()
    }
  }

  delegateCommand (trigger, params) {
    var injectedParams = params

    let commandIteration = c => {
      if (!c.command.context.enabled) {
        this._nextCommand(commandIteration)
      } else if (c.command.trigger === '*' || c.command.trigger.toLowerCase() === trigger.toLowerCase()) {
        this.addInjectable('Trigger', trigger)
        Promise.resolve(c.command.execute(this.injectables, injectedParams)).then(result => {
          this._nextCommand(commandIteration)
        }).catch(e => {
          let tzuyu = this.getInjectable('Tzuyu')
          tzuyu.message(e.message)
          console.error(e)
        })
      } else {
        this._nextCommand(commandIteration)
      }
        /* temp(?) disable chaining
        if (typeof result !== 'undefined' && Array.isArray(result)) {
          // if we get a result then chain it further
          injectedParams = result
        } else {
          // if we dont get a result then set it back to the passed values
          injectedParams = params
        } */
    }

    this._nextCommand(commandIteration)
  }

  resolveParamsFromMessage (message) {
    // should return {command: command, params: []}
    if (!message.startsWith(this.prefix)) {
      return false
    }

    let input = message.split(' ')
    let command = input[0].substring(1)
    input.shift()

    return {
      command: command,
      params: [...input]
    }
  }

  isTriggerRegistered (trigger) {
    for (let c of this.commands) {
      if (c.command.trigger.toLowerCase() === trigger.toLowerCase()) {
        return true
      }
    }
    return false
  }

  findCommand (trigger) {
    for (let c of this.commands) {
      if (c.command.trigger.toLowerCase() === trigger.toLowerCase()) {
        return c.command
      }
    }
    return false
  }
}

module.exports = CommandDelegator
