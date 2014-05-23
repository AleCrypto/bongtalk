Bongtalk
========

node.js web chat server.

sample service is running at https://talk.talsu.net and http://bongtalk.herokuapp.com

## Installation

```bash
$ [sudo] npm install bongtalk -g
```


## Usage

### Execute server on command line
```
Usage : bongtalk -p [num] -r [url] -i [num]  -s -w -o

Options:
  -p, --port        listen port
  -r, --redisurl    redis server url
  -s, --single      use only 1 process
  -w, --websocket   use websocket protocol
  -o, --socketonly  run socket.io server only
  -i, --instance    instance count for cluster mode
```
#### Set config file (config.json)
```json
{
	"servicePort" : "3000", // listen port
	"redisUrl" : "redis://localhost:6379", // redis server url [requried]	
	"single" : true, // use only 1 process
	"websocket" : true, // use websocket
	"isSocketOnly" : false, // run socket.io server only (do not service .html files)
	"instanceCount" : 1, // instance count for cluster mode
	"socketIoLogLevel" : 1, // socket.io log output level
	"isDebug" : false // debug mode
}
```
#### Example
```bash
$ bongtalk --port 3000 --redisurl redis://talsu.net
```
Connect web browser to http://localhost:3000

### Module
```javascript
var BongtalkServer = require('./BongtalkServer').BongtalkServer;

var config = { 
  servicePort: 3000,
  redisUrl: 'redis://localhost',
  single: true,
  websocket: true,
  isSocketOnly: false,
  instanceCount: 1,
  socketIoLogLevel: 1,
  isDebug: false 
};

new BongtalkServer(config).run();
// Connect web browser to http://localhost:3000
```
