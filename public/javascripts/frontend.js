﻿"use strict";

$(function () {
    var client = new TalkClient();

    // for better performance - to avoid searching in DOM
    var header = $('#header');
    var content = $('#chatMessages');
    var input = $('#inputMessage');
    var status = $('#status');
    var useSavedNameButton = $('#useSavedNameButton');

    client.me.name = getURLParameter('username');
    client.zoneId = getURLParameter('zone');
    client.zoneId = client.zoneId ? client.zoneId : 'default';

    var usernameStoragePath = 'bongtalk({zone=' + client.zoneId + '}).savedName';

    var reconnected = false;
    // open connection
    var connection = null;
    createConnection();
    function createConnection(){
        if (connection !== null){
            connection.close();
        }

        var socketUrl = 'http://' + location.host;
        connection = io.connect(socketUrl,{
            'max reconnection attempts' : Infinity
        });

        connection.on('connect', function() {writeSystemMessage('Connected', 'success');});
        connection.on('connecting', function () {writeSystemMessage('Connecting...', 'warning');});
        connection.on('connect_failed', function () {writeSystemMessage('Connect fail', 'error');});

        connection.on('disconnect', function(){writeSystemMessage('Disconnected', 'warning'); onDisconnect(); });
        connection.on('error', function () {writeSystemMessage('Error', 'error');});

        connection.on('reconnect', function () {writeSystemMessage('Reconnected', 'success'); reconnected = true; });
        connection.on('reconnecting', function () {writeSystemMessage('Reconnecting...', 'warning');});
        connection.on('reconnect_failed', function () {writeSystemMessage('Reconnect fail', 'error');});

        connection.on('sendProfile', function(data){
            //server 부터 받은 profile
            client.me.id = data.id;

            if (reconnected) {
                connection.emit('joinZone', {user:client.me.getSimpleUser(), zoneId:client.zoneId});
            }
            else {
                // 이름을 결정한 뒤 Join 하라.
                createName(function()
                {
                    connection.emit('joinZone', {user:client.me.getSimpleUser(), zoneId:client.zoneId});
                });
            }
        });

        connection.on('newUser', function(data){
            if (client.addUser(new TalkUser(data.id, data.name))){
                writeSystemMessage(data.name + ' joined.', 'info');
            }
        });

        connection.on('sendZoneInfo',function(data){
            //history 로드
            data.history.forEach(function(item){
                addMessage(item.user.id, item.user.name, item.message, new Date(item.time), '');
            });

            // 사용자 list 초기화
            data.connectedUsers.forEach(function(item) {
                client.addUser(new TalkUser(item.id, item.name));
            });

            writeSystemMessage('Join success.', 'info');

            if (client.getOtherUserNames().length > 0)
            {
                var otherNames =  client.getOtherUserNames().reduce(function(x, y){ return x + ", " + y;});
                writeSystemMessage('Connected users : ' + otherNames, 'info');
            }

            input.removeAttr('disabled');
            input.focus();

            // 참여가 완료 된것으로 봄.
            reconnected = false;
        });

        connection.on('sendMessage', function(data){
            addMessage(data.user.id, data.user.name, data.message, new Date(data.time), '');
        });

        connection.on('changeName', function(data){
            var targetUser = client.getUser(data.id);
            if (targetUser)
            {
                writeSystemMessage(targetUser.name + ' changed name → ' + data.name, 'info');
                targetUser.name = data.name;
            }
        });

        connection.on('removeUser', function(data){
            var removedUser = client.removeUser(data.id);
            if (removedUser)
            {
                writeSystemMessage(removedUser.name + ' out.', 'info');
            }
        });
    }

    function onDisconnect() {
        client.others = [];
        input.attr('disabled', 'disabled');
    }


    var setNameCallback = null;
    function createName(callback)
    {
        setNameCallback = callback;
        var savedName = null;
        if (IsSupportStorage())
        {
            savedName = localStorage[usernameStoragePath];
        }

        if (savedName)
        {
            useSavedNameButton.text('Use \'' + savedName + '\'');
        }
        else
        {
            useSavedNameButton.hide();
        }

        $('#changeNameModal').modal('show');
        $('#nameInput').focus();
    }

    $('#openChangeNamePopup').click(function(){
        setNameCallback = function() {
            connection.emit('changeName', client.me.name);
        };
    });


    /**
     * Send mesage when user presses Enter key
     */
    input.keydown(function(e) {
        if (e.keyCode === 13) { // Enter 키
            sendMessage();
        }
    });

    $('#sendButton').click(sendMessage);

    function getURLParameter(name) {
        return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null;
    }

    function sendMessage(){
        var msg = input.val();
        if (!msg) { // 입력한거 없음 안보냄?
            return;
        }
        // send the message as an ordinary text
//        connection.send(JSON.stringify({type:"sendMessage", payload:{message: msg, style: input[0].style.cssText}}));
        connection.emit('sendMessage', msg);
        input.val('');
        input.focus();
        // 서버에서 응답 오기전까지 입력창 막음 . 잘하는 짓인가?
        //input.attr('disabled', 'disabled');
    }

    /**
     * 메세지 라인추가.
     */
    function addMessage(id, author, message, dt, textStyle) {
        content.append('<p id="messageId:'+ id +'"><span>' + author + '</span> @ ' +
                        (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':' +
                        (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes()) +
                        ': <span style="' + textStyle + '">' + message + '</span></p>');
        scrollEnd();
    }

    /**
     * 스크롤 끝으로 옮김.
     */
    function scrollEnd(){
        var body = $('body');
        body[0].scrollTop = body[0].scrollHeight;
    }

    useSavedNameButton.click(useSavedName);
    function useSavedName(){
        if (IsSupportStorage())
        {
            $('#nameInput').val(localStorage[usernameStoragePath]);
        }
        setName();
    }

    $('#saveNameButton').click(setName);
    function setName(){
        var newName = $('#nameInput').val();

        if (newName === client.me.name)
        {
            return;
        }

        client.me.name = newName;

        status.text(client.me.name);

        header.text(client.me.name);

        if (IsSupportStorage())
        {
            localStorage[usernameStoragePath] = client.me.name;
            useSavedNameButton.text('Use \'' + client.me.name + '\'');
        }

        if (setNameCallback)
        {
            setNameCallback();
        }

        input.focus();
    }

    /**
     * warning, error, info, sucess
     */
    function writeSystemMessage(message, level){
        var levels = ['warning', 'error', 'info', 'success'];

        var selectedClass = levels.some(function (item){return item === level;}) ? "text-" + level : "muted";

        var line = '<p class="' + selectedClass + '">' + message + '</p>';

        content.append(line);

        scrollEnd();
    }

    /**
     * @return {boolean}
     */
    function IsSupportStorage() {
        try {
            return 'localStorage' in window && window.localStorage !== null;
        } catch (e) {
            return false;
        }
    }
});