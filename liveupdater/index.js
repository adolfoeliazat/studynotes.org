module.exports = LiveUpdater

var _ = require('underscore')
var async = require('async')
var config = require('../config')
var debug = require('debug')('studynotes:liveupdater')
var engine = require('engine.io')
var http = require('http')
var model = require('../model')
var util = require('../util')

function LiveUpdater (opts, cb) {
  var self = this
  if (opts) util.extend(self, opts)

  /** @type {number} port */
  self.port || (self.port = config.ports.liveupdater)
  self.online = {}

  self.start(cb)
}

LiveUpdater.prototype.start = function (done) {
  var self = this
  done || (done = function () {})

  var server = http.createServer()
  self.engine = engine.attach(server, {
    transports: ['polling', 'websocket']
  })
  self.engine.on('connection', function (socket) {
    socket.on('message', self.onSocketMessage.bind(self, socket))
    socket.on('close', self.onSocketClose.bind(self, socket))
  })

  async.series([
    model.connect,
    function (cb) {
      self.getTotalHits(cb)
    },
    function (cb) {
      server.listen(self.port, cb)
    }
  ], done)
}

LiveUpdater.prototype.getOnlineCount = function (pathname) {
  var self = this

  if (pathname === '/') {
    // Show total users across site on homepage
    var count = 0
    for (var p in self.online) {
      var sockets = self.online[p]
      count += sockets.length
    }
    return count
  } else {
    return self.online[pathname].length
  }
}

LiveUpdater.prototype.getTotalHits = function (cb) {
  var self = this
  async.map(_(model.models).toArray(), function (model, cb) {
    model
      .find()
      .select('hits -_id')
      .exec(cb)
  }, function (err, results) {
    if (err) return cb(err)

    self.totalHits = _(results).reduce(function (acc, docs) {
      return acc + _(docs).reduce(function (acc2, doc) {
        return acc2 + (doc.hits || 0)
      }, 0)
    }, 0)

    cb(null)
  })
}

LiveUpdater.prototype.sendUpdates = function (pathname) {
  var self = this
  var sockets = self.online[pathname]

  // Early return if there are no updates to send
  if (!sockets || sockets.length === 0) return

  var update = {
    type: 'update',
    count: self.getOnlineCount(pathname)
  }

  if (pathname === '/') {
    update.totalHits = self.totalHits
  }

  var message = JSON.stringify(update)
  sockets.forEach(function (socket) {
    socket.send(message)
  })

  if (pathname !== '/') self.sendUpdates('/')
}


LiveUpdater.prototype.onSocketMessage = function (socket, str) {
  var self = this
  var message
  try {
    debug('Received message: ' + str)
    message = JSON.parse(str)
  } catch (e) {
    debug('Discarding non-JSON message: ' + message)
    return
  }
  if (message.type === 'online') {
    // Only accept the first 'online' message
    if (socket.pathname) return

    var pathname = message.pathname
    socket.pathname = pathname

    // If this is a new path, create new array
    if (self.online[pathname] === undefined) {
      self.online[pathname] = []
    }

    self.online[pathname].push(socket)

    self.totalHits += 1

    self.sendUpdates(pathname)
  }
}

LiveUpdater.prototype.onSocketClose = function (socket) {
  var self = this
  var sockets = self.online[socket.pathname]

  if (sockets) {
    var index = sockets.indexOf(socket)
    sockets.splice(index, 1)
    self.sendUpdates(socket.pathname)
  }
}

if (!module.parent) util.run(LiveUpdater)