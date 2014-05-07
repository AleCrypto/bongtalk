define(['app', 'socket'], function (app, io){
	app.controller('listCtrl', function($scope){
		$scope.items = [
			{name:'beta', age : 1},
			{name:'alpha', age : 2}
		];
		// setInterval(function(){
		// 	// $scope.$apply(function(){
		// 		$scope.items.push({name:'aa', age:10});	
		// 	// });
			
		// }, 1000)
		$scope.orderProp = 'age';
		$scope.serverStatus = 'before connect';
		var socket = io.connect();
		socket.on('connect', function () {
			setServerStatusString('connect');
			socket.emit('getAllChannel', {});
		});
		socket.on('connecting', function () {setServerStatusString('connecting');});
		socket.on('disconnect', function () {setServerStatusString('disconnect');});
		socket.on('connect_failed', function () {setServerStatusString('connect_failed');});
		socket.on('error', function () {setServerStatusString('error');});
		socket.on('message', function (message, callback) {setServerStatusString('message - ' + message);});
		socket.on('anything', function (data, callback) {setServerStatusString('anything - ' + data);});
		socket.on('reconnect_failed', function () {setServerStatusString('reconnect_failed');});
		socket.on('reconnect', function () {setServerStatusString('reconnect');});
		socket.on('reconnecting', function () {setServerStatusString('reconnecting');});

		socket.on('receiveAllChannel', function(channels){
			console.log('receiveAllChannel - ' + channels);
			$scope.$apply(function(){
				$scope.item = channels;
			});
		});

		function setServerStatusString(str){
			$scope.$apply(function(){
				console.log(str);
				$scope.serverStatus = str;
			});
		}
	});
});