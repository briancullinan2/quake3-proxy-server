

const CHALLENGE_MIN_LENGTH = 9
const CHALLENGE_MAX_LENGTH = 12

function buildChallenge() {
	let challenge = ''
	let length = CHALLENGE_MIN_LENGTH - 1 +
		parseInt(Math.random() * (CHALLENGE_MAX_LENGTH - CHALLENGE_MIN_LENGTH + 1), 10)

	for (let i = 0; i < length; i++) {
		let c
		do {
			c = Math.floor(Math.random() * (126 - 33 + 1) + 33); // -> 33 ... 126 (inclusive)
		} while (c === '\\'.charCodeAt(0) || c === ';'.charCodeAt(0) || c === '"'.charCodeAt(0) || c === '%'.charCodeAt(0) || c === '/'.charCodeAt(0))

		challenge += String.fromCharCode(c)
	}

	return challenge
}

module.exports = buildChallenge

