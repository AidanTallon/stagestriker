// export errors and logs to text files?

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = 3000;

app.use(express.static(__dirname + '/client'));

http.listen(port, function() {
	console.log('listening on *:' + port);
});

var stageList = {
	'Wii U': {
		'Starter': ['Final Destination', 'Battlefield', 'Smashville', 'Dreamland 64', 'Lylat Cruise'],
		'Counterpick': ['Duck Hunt', 'Town and City']
	},
	'3DS': {
		'Starter': ['Battlefield', 'Dreamland', 'Duck Hunt', 'Final Destination', "Yoshi's Island"],
		'Counterpick': ['Arena Ferox', 'Prism Tower']
	},
	'Brawl': {
		'Starter': ['Battlefield', 'Final Destination', 'Lylat Cruise', 'Smashville', "Yoshi's Island"],
		'Counterpick': ['Halberd', 'Pokemon Stadium', 'Castle Siege']
	},
	'Melee': {
		'Starter': ['Battlefield', 'Dreamland', 'Final Destination', 'Fountain of Dreams', "Yoshi's Story"],
		'Counterpick': ['Pokemon Stadium']
	},
	'64': {
		'Starter': ['Dreamland'],
		'Counterpick': []
	},
	'Project M': {
		'Starter': ['Battlefield', 'Final Destination', 'Pokemon Stadium 2', 'Green Hill Zone', "Delfino's Secret"],
		'Counterpick': ['Dreamland', 'Warioware', 'Castle Siege', 'Tower of Salvation']
	}		
};

var usersOnline = {};
var roomsOnline = {};

var User = function(username, id) {
	this.username = username;
	this.id = id;
	this.room = null;
};

var Stage = function(name, type, game) {
	this.name = name;
	this.type = type;
	this.game = game;
	this.struck = false;
};

var Room = function(id, game) {
	this.id = id;
	this.users = [];
	this.game = game;
	this.stages = createStages(game);
};

function createStages(game) {
	var stages = {};
	for (var stage of stageList[game]['Starter']) {
		stages[stage] = new Stage(stage, 'Starter', game);
	};
	for (var stage of stageList[game]['Counterpick']) {
		stages[stage] = new Stage(stage, 'Counterpick', game);
	};
	return stages;
};

io.on('connection', function(socket) {
	var user;
	socket.on('login', function(username) {
		if (username == '') {
			socket.emit('login', {'success': false, 'username': username, 'id': socket.id, 'errorMessage': 'Username must not be blank.'});
		}
		else if (username.length > 32) {
			socket.emit('login', {'success': false, 'username': username, 'id': socket.id, 'errorMessage': 'Username must be less than 32 characters.'});
		}
		else {
			username = username.replace(/</g, '&lt;').replace(/>/g, '&gt;');
			user = new User(username, socket.id);
			usersOnline[user.id] = user;
			socket.emit('login', {'success': true, 'username': user.username, 'id': user.id});
		}
	});
	
	socket.on('disconnect', function() {
		if (!user) {
			return;
		}
		else if (user.room) {
			var index = user.room.users.indexOf(user.id);
			user.room.users.splice(index, 1);
			if (user.room.users.length < 1) {
				delete roomsOnline[user.room.id];
			};
		};
		delete usersOnline[user.id];
	});
	
	socket.on('create', function(roomId, game) {
		if (!roomsOnline[roomId]) {
			user.room = new Room(roomId, game);
			roomsOnline[roomId] = user.room;
			user.room.users.push(user.id);
			socket.join(user.room.id);
			socket.emit('created', {'success': true, 'roomId': user.room.id, 'game': user.room.game, 'stages': user.room.stages});
		}
		else {
			socket.emit('created', {'success': false, 'roomId': roomId, 'game': game, 'stages': null, 'errorMessage': 'Server error.'}); // TODO: Better error messages
		};
	});
	
	socket.on('leave', function() {
		if (user.room) {
			socket.leave(user.room.id);
			var index = user.room.users.indexOf(user.id);
			user.room.users.splice(index, 1);
			if (user.room.users.length < 1) {
				delete roomsOnline[user.room.id];
			}
		}
	});
	
	socket.on('join', function(roomId) {
		if (roomsOnline[roomId]) {
			user.room = roomsOnline[roomId];
			user.room.users.push(user.id);
			socket.join(user.room.id);
			io.in(user.room.id).emit('joined', {'success': true, 'roomId': user.room.id, 'game': user.room.game, 'stages': user.room.stages, 'users': user.room.users});
		}
		else {
			socket.emit('joined', {'success': false, 'room-id': roomId, 'game': null, 'stages': null, 'errorMessage': 'Room not found.'});
		};
	});
	
	socket.on('strike', function(stage) {
		var i = user.room.stages[stage.name];
		i.struck = stage.struck;
		io.in(user.room.id).emit('strike', {'stageName': i.name, 'struck': i.struck});
	});
	
	socket.on('message', function(message) {
		message['message'] = message['message'].replace(/</g, '&lt;').replace(/>/g, '&gt;');
		socket.broadcast.to(user.room.id).emit('message', message);
	});
});