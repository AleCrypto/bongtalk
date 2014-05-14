var http = require('http');
var path = require('path');
var util = require('util');
var Guid = require('guid');
var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var methodOverride = require('method-override');
var errorhandler = require('errorhandler');
var session = require('express-session');

var Sockets = require('socket.io');
var SessionSockets = require('session.socket.io');

var RedisStore = require('connect-redis')(session);

var tools = require('./tools');
var SocketHandler = require('./socketHandler').SocketHandler;
var RedisDatabase = require('./RedisDatabase').RedisDatabase;

var config = require('./config');

// var models = require('./models');
// var RedisDatabase = models.RedisDatabase;
// var JadeDataBinder = models.JadeDataBinder;

var secretString = 'bongtalkSecret';

exports.BongTalkServer = (function(){
	function BongTalkServer(servicePort, redisUrl){
		this.servicePort = process.env.PORT || servicePort;
		this.redisUrl = redisUrl;
		this.sessionStore = new RedisStore({client:tools.createRedisClient(this.redisUrl)});
		this.cookieParser = cookieParser(secretString);
		this.database = new RedisDatabase(tools.createRedisClient(this.redisUrl), Guid.create().value);

		this.SocketRedisStore = new Sockets.RedisStore({
			redisPub : tools.createRedisClient(this.redisUrl),
			redisSub : tools.createRedisClient(this.redisUrl),
			redisClient : tools.createRedisClient(this.redisUrl)
		});
	}

	BongTalkServer.prototype.run = function(){
		var self = this;
		var app = express();
		app.use(logger('dev'));
		app.use(express.static(__dirname + '/public'));
		app.use(bodyParser());
		app.use(methodOverride());
		app.use(this.cookieParser);
		app.use(session({ store: this.sessionStore, key: 'jsessionid', secret: secretString }));

		app.use(errorhandler());
		// app.use(function(req, res){
		// 	res.send('Hello');
		// });

		// app.get('/', function(req, res){
		// 	res.send('hello world');
		// });
		var server = http.createServer(app);
        server.listen(this.servicePort);

		var io = Sockets.listen(server);
		io.set('log level', config.socketIoLogLevel);
		io.set('store', this.SocketRedisStore);

		// var sessionSockets = new SessionSockets(io, this.sessionStore, this.cookieParser, 'jsessionid');
		var socketHandler = new SocketHandler(this.database);

		socketHandler.use(io.sockets);
	};


	return BongTalkServer;
})();

// var server = new BongTalkServer(3000, 'redis://talsu.net');
// server.run();