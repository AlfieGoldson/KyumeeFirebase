const { db } = require('../util/admin');

exports.getUser = async (data, context) => {
	try {
		const userID = data.userID;

		const [userDoc, players, queues] = await Promise.all([
			db.doc(`/users/${userID}`).get(),
			db
				.collection('players')
				.where('user', '==', userID)
				.get(),
			db
				.collection('queues')
				.where('user', '==', userID)
				.get()
		]);

		if (!userDoc.exists)
		    return { status: 404, json: { error: 'User not found' } };

		const userData = {
			id: userDoc.id,
			...userDoc.data(),
			players: players.docs.map(doc => ({ id: doc.id, ...doc.data() })),
			queues: queues.docs.map(doc => ({ id: doc.id, ...doc.data() }))
		};
        
		return { status: 200, json: userData };
	} catch (e) {
		return { status: 500, json: { error: e.code } };
	}
};

exports.getAllUsers = async (data, context) => {
	try {
		const usersData = await db.collection('users').get();
		let users = usersData.docs.map(doc => ({ id: doc.id, ...doc.data() }));
		return { status: 200, json: users };
	} catch (e) {
        return { status: 500, json: { error: 'Something went wrong' } };
	}
};

exports.createUser = async (data, context) => {
	try {
        const { userID, name } = data;
        // TODO: make a function that doesn't need an userID to create a new user
		if (!userID || !name)
            return { status: 400, json: { error: `Bad Request` } };

		const userDoc = db.doc(`users/${userID}`).get();
		if (userDoc.exists) {
			await userDoc.update({ name });
        return { status: 201, json: `user successfully updated!` };
		} else {
			await db.doc(`users/${userID}`).set({
				name,
				created: new Date()
			});
            return { status: 201, json: `user successfully created!` };
		}
	} catch (e) {
        return { status: 500, json: { error: 'Something went wrong' } };
	}
};

exports.startQueue = async (data, context) => {
	try {
		const userID = data.userID;
		const event = data.event;
		const bracket = data.bracket;

		const bracketDoc = await db.doc(`brackets/${bracket}`).get();

		if (!bracketDoc.exists)
            return { status: 404, json: { error: "Bracket doesn't exist" } };

		const { whitelist, blacklist, specs } = bracketDoc.data();

		if (whitelist.active && !whitelist.users.includes(userID))
            return { status: 403, json: { error: "Not Whitelisted!" } };

		if (blacklist.active && blacklist.users.includes(userID))
            return { status: 403, json: { error: "Blacklisted!" } };

		const [userDoc, playerDocs, activeQueues] = await Promise.all([
			db.doc(`/users/${userID}`).get(),
			db
				.collection('players')
				.where('user', '==', userID)
				.where('bracket', '==', bracket)
				.get(),
			db
				.collection('queues')
				.where('user', '==', userID)
				.where('bracket', '==', bracket)
				.where('active', '==', true)
				.get()
		]);

		if (!userDoc.exists)
            return { status: 404, json: { error: 'User not found' } };

		const playerDoc =
			playerDocs.docs.length > 0
				? playerDocs.docs[0]
				: await db.collection('players').add({
						user: userID,
						bracket,
						ratings: [specs.start_rating],
						created: new Date()
				  });

		if (activeQueues.docs.length > 0)
            return { status: 400, json: { error: `User already in the ${bracket} queue!` } };

		const newQueue = {
			user: userID,
			player: playerDoc.id,
			bracket,
			active: true,
			created: new Date()
		};

		await db.collection('queues').add(newQueue);
        return { status: 201, json: `User is now in queue!` };
	} catch (e) {
        return { status: 500, json: { error: e.code } };
	}
};

exports.endQueue = async (data, context) => {
	try {
		const userID = data.userID;
		const bracket = data.bracket;

		const [userDoc, activeQueues] = await Promise.all([
			db.doc(`/users/${userID}`).get(),
			db
				.collection('queues')
				.where('user', '==', userID)
				.where('bracket', '==', bracket)
				.where('active', '==', true)
				.get()
		]);

		if (!userDoc.exists)
            return { status: 404, json: { error: 'User not found' } };
		if (activeQueues.docs.length <= 0)
            return { status: 404, json: { error: 'Not in queue' } };

		await Promise.all(
			activeQueues.docs.map(doc =>
				db.doc(`/queues/${doc.id}`).update({ active: false })
			)
		);
        
        return { status: 200, json: `${activeQueues.length} queue(s) stopped` };
	} catch (e) {
        return { status: 500, json: { error: e.code } };
	}
};
