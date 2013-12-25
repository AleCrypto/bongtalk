/**
 * Created by Talsu on 13. 11. 22.
 */
"use strict";

var util = require('util');

exports.JadeDataBinder = (function(){
    function JadeDataBinder(bongtalk){
        this.bongtalk = bongtalk;
        this.channels = [];
    };

    JadeDataBinder.prototype.loadData = function(callback){
        var _this = this;
        this.channels = [];
        this.bongtalk.database.getAllChannelsKey(function(err, channelIds){

            if (err || !channelIds || channelIds.length == 0){
                callback();
                return;
            }

            _this.channels = channelIds.map(function(item){return {id:item, users:[]};});

            var numCompletedCalls = 0
            _this.channels.forEach(function(channel){
                _this.bongtalk.database.getUsersFromChannel(channel.id, function(err, users){
                    channel.users = users;
                    numCompletedCalls++;
                    if (numCompletedCalls == _this.channels.length){
                        numCompletedCalls = 0;
                        callback();
                    }
                });
            });
        });
    };

    JadeDataBinder.prototype.getChannels = function(){
        return this.channels;
    };

    JadeDataBinder.prototype.getUsers = function(channelId){
        for (var i = 0; i < this.channels.length; ++i){
            if (this.channels[i].id == channelId){
                return this.channels[i].users
            }
        }

        return [];
    };

    JadeDataBinder.prototype.arrayToGroup = function(array, groupSize){

        var result = [];
        var line = [];
        result.push(line);
        for (var i = 0; i < array.length; ++i){
            if (i % groupSize === groupSize - 1){
                line.push(array[i]);
                line = [];
                result.push(line);
            }
            else{
                line.push(array[i]);
            }
        }

        return result;
    };



    return JadeDataBinder;
})();

exports.RedisDatabase = (function(){
    function RedisDatabase(redisClient){
        this.redisClient = redisClient;
    };

//    RedisDatabase.prototype.getOrCreateUser = function (userId, callback) {
//        this.getOrCreateHash('User', userId, callback);
//    };

    RedisDatabase.prototype.addUserToChannel = function (channelId, userId, userName, callback){
        var _redisClient = this.redisClient;

        var channelSetKey = "ChannelSet";
        var channelUserSetKey = "Channel:" + channelId + ":UserSet";
        var userChannelSetKey = "User:" + userId + ":ChannelSet";
        var userNameInChannelKey = "Channel:" + channelId + ":User:" + userId + ":name";

        _redisClient
            .multi()
            .sadd(channelSetKey, channelId)
            .sadd(channelUserSetKey, userId)
            .sadd(userChannelSetKey, channelId)
            .set(userNameInChannelKey, userName)
            .exec(callback);
    };

    RedisDatabase.prototype.removeUserFromChannel = function (channelId, userId, callback){
        var _redisClient = this.redisClient;

        var channelSetKey = "ChannelSet";
        var channelUserSetKey = "Channel:" + channelId + ":UserSet";
        var userChannelSetKey = "User:" + userId + ":ChannelSet";
        var userNameInChannelKey = "Channel:" + channelId + ":User:" + userId + ":name";
        var userStatusInChannelKey = "Channel:" + channelId + ":User:" + userId + ":status";
        var connectionCountKey = "Channel:" + channelId + ":User:" + userId + ":connectionCount";

        _redisClient
            .multi()
            .srem(channelUserSetKey, userId)
            .srem(userChannelSetKey, channelId)
            .del(userNameInChannelKey)
            .del(userStatusInChannelKey)
            .del(connectionCountKey)
            .exec(function(err, result){
                if (err){
                    callback(err, result);
                }
                else{
                    _redisClient.scard(channelUserSetKey, function(err, number){
                        if (!err && number == 0){
                            _redisClient.srem(channelSetKey, channelId, callback);
                        }
                        else{
                            callback(err, number);
                        }
                    })
                }
            });
    };

    RedisDatabase.prototype.getUserName = function (channelId, userId, callback){
        this.getUserProperty(channelId, userId, 'name', callback);
    }

    RedisDatabase.prototype.setUserName = function (channelId, userId, userName, callback){
        this.setUserProperty(channelId, userId, 'name', userName, callback);
    }

    RedisDatabase.prototype.getUserProperty = function (channelId, userId, propertyName, callback){
        var key = "Channel:" + channelId + ":User:" + userId + ":" + propertyName;
        this.redisClient.get(key, callback);
    }

    RedisDatabase.prototype.getUserProperties = function (channelId, userId, propertyNames, callback){
        if (propertyNames && Array.isArray(propertyNames)){
            var keys = propertyNames.map(function(name){return "Channel:" + channelId + ":User:" + userId + ":" + name;});
            this.redisClient.mget(keys, callback);
        }
        else{
            callback('bad property name', []);
        }
    }

    RedisDatabase.prototype.setUserProperty = function(channelId, userId, propertyName, value, callback){
        var key = "Channel:" + channelId + ":User:" + userId + ":" + propertyName;
        this.redisClient.set(key, value, callback);
    };

    RedisDatabase.prototype.getUserFromChannel = function(channelId, userId, callback){
        var _redisClient = this.redisClient;
        var userProperties = ['name', 'status', 'connectionCount'];

        var propertyKeys = userProperties.map(function(property){return "Channel:" + channelId + ":User:" + userId + ":" + property;});
        _redisClient.mget(propertyKeys, function(err, properties){
            if (err){
                callback(err, null);
            }
            else{
                var user = {
                    id : userId
                }
                for (var i in userProperties){
                    user[userProperties[i]] = properties[i];
                }
                callback(null, user);
            }
        });
    };

    RedisDatabase.prototype.getUsersFromChannel = function(channelId, callback){
        var _redisClient = this.redisClient;

        var channelUserSetKey = "Channel:" + channelId + ":UserSet";

        _redisClient.smembers(channelUserSetKey, function(err, userIds){
            if (err || !(userIds instanceof Array) || userIds.length <= 0){
                callback(err, []);
            }
            else{
                var userProperties = ['name', 'status', 'connectionCount'];
                var multi = _redisClient.multi();
                userIds.forEach((function(userId){
                    multi.mget(userProperties.map(function(property){return "Channel:" + channelId + ":User:" + userId + ":" + property;}));
                }));
                multi.exec(function(err, replies){
                    if (!err && userIds.length === replies.length){
                        var index = 0;
                        var users = userIds.map(function(userId){
                            var user = {
                                id : userId
                            }
                            for (var i in userProperties){
                                user[userProperties[i]] = replies[index][i];
                            }
                            index++;
                            return user;
                        });

                        callback(err, users);
                    }
                    else{
                        callback(err, []);
                    }
                });
            }
        });
    };

    RedisDatabase.prototype.getChannelsFromUser = function(userId, callback){
        var _redisClient = this.redisClient;

        var userChannelSetKey = "User:" + userId + ":ChannelSet";

        _redisClient.smembers(userChannelSetKey, function(err, channelIds){
            if (err || !(channelIds instanceof Array) || channelIds.length <= 0){
                callback(err, []);
            }
            else{
                var multi = _redisClient.multi();
                channelIds.forEach(function(item){multi.hgetall('ChannelHash:'+item);});
                multi.exec(function(err, replies){
                    if (err){
                        callback(err, replies);
                    }
                    else{
                        if (channelIds.length === replies.length){
                            for (var i = 0; i < channelIds.length; ++i){
                                replies[i]['id'] = channelIds[i];
                            }
                        }

                        callback(err, replies);
                    }
                });
            }
        });
    };

    RedisDatabase.prototype.getAllChannelsKey = function(callback){
        this.redisClient.smembers("ChannelSet", callback);
    };

    RedisDatabase.prototype.addTalkHistory = function(channelId, talk, callback){
        var channelHistoryKey = "Channel:" + channelId + ":HistoryList";
        var talkJson = JSON.stringify(talk);
        this.redisClient
            .multi()
            .lpush(channelHistoryKey, talkJson)
            .ltrim(channelHistoryKey, 0, 100)
            .exec(callback);
    };

    RedisDatabase.prototype.getTalkHistory = function(channelId, callback){
        var channelHistoryKey = "Channel:" + channelId + ":HistoryList";
        this.redisClient.lrange(channelHistoryKey, 0, 100, function(err, talkJsons){
            if (err || !talkJsons || !Array.isArray(talkJsons)){
                callback(err, talkJsons);
            }
            else{
                var talks = talkJsons.map(function(talkJson){return JSON.parse(talkJson);}).reverse();
                callback(err, talks);
            }
        });
    };

    RedisDatabase.prototype.increaseConnectionCount = function(channelId, userId, callback){
        var connectionCountKey = "Channel:" + channelId + ":User:" + userId + ":connectionCount";
        this.redisClient.incr(connectionCountKey, callback);
    };

    RedisDatabase.prototype.decreaseConnectionCount = function(channelId, userId, callback){
        var connectionCountKey = "Channel:" + channelId + ":User:" + userId + ":connectionCount";
        this.redisClient.decr(connectionCountKey, callback);
    };

    return RedisDatabase;
})();