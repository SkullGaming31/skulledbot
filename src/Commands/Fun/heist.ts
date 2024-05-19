import { ChatMessage } from '@twurple/chat/lib';
import { randomInt } from 'crypto';
import fs from 'fs';
import { getChatClient } from '../../chat';
import { UserModel } from '../../database/models/userModel';
import { Command } from '../../interfaces/Command';
import { sleep } from '../../util/util';
import { ParticipantModel } from '../../database/models/Participant';
import { InjuryModel } from '../../database/models/injury';

type LootValue = {
	[itemName: string]: number | Gems | Antique | Artwork | Cash;
};

const lootValues: LootValue = {
	gold: 2000,
	silver: 1500,
	artwork: {
		Paintings: 5000,
		Sculptures: 4000,
		Prints: 3000,
		Photography: 2000,
		Tapestry: 1500,
		ArtisticInstallations: 1000,
		DecorativeArtObjects: 500,
	},
	antique: {
		RareCoins: 1000,
		Currency: 800,
		Documents: 1200,
		Artifacts: 2500,
		Jewelry: 2000,
		Timepieces: 1500,
		Porcelain: 800,
		Ceramics: 1000,
		Collectibles: 1200,
	},
	gems: {
		ruby: 1000,
		diamond: 2000,
		sapphire: 1500,
		Emerald: 1800,
		Aquamarine: 1200,
		Topaz: 800,
		Opal: 1000,
		Amethyst: 900,
		Garnet: 700,
		Pearl: 600,
	},
	cash: {
		Bill1000: 1000,
		Bill500: 500,
		Bill5000: 5000,
		Bill10000: 10000,
		Bill100000: 100000,
	},
	documents: 500,
};

interface Cash {
	Bill1000: number;
	Bill500: number;
	Bill5000: number;
	Bill10000: number;
	Bill100000: number;
}

interface Artwork {
	Paintings: number;
	Sculptures: number;
	Prints: number;
	Photography: number;
	Tapestry: number;
	ArtisticInstallations: number;
	DecorativeArtObjects: number;
}

interface Antique {
	RareCoins: number;
	Currency: number;
	Documents: number;
	Artifacts: number;
	Jewelry: number;
	Timepieces: number;
	Porcelain: number;
	Ceramics: number;
	Collectibles: number;
}

interface Gems {
	diamond: number;
	ruby: number;
	sapphire: number;
	Emerald: number;
	Aquamarine: number;
	Topaz: number;
	Opal: number;
	Amethyst: number;
	Garnet: number;
	Pearl: number;
}

interface LootResult {
	totalAmount: number;
	items: string[];
	message: string;
}
export interface Injury {
	severity: string;
	duration: number;
	description: string;
	timestamp: number;
}

interface InjuryData {
	[participantName: string]: Injury[];
}
interface Zone {
	name: string;
	difficulty: string;
}

// Store an array to keep track of participants
let participants: string[] = [];
let isHeistInProgress: boolean = false;
let betAmount: number = 0;

const participantData: { [participantName: string]: { injuries: Injury[] } } = {};
// Define a JSON object to store the injury data
const injuryData: { [participantName: string]: Injury[] } = {};

const heist: Command = {
	name: 'heist',
	description: 'start a heist with friends',
	usage: '!heist <amount> <zone>',
	execute: async (channel: string, user: string, args: string[], text: string, msg: ChatMessage) => {
		const chatClient = await getChatClient();
		// Extract the amount from the command arguments
		const amount = parseInt(args[0]);
		betAmount = amount;

		// Function to load injury data from MongoDB
		async function loadInjuryDataFromMongoDB(): Promise<InjuryData> {
			try {
			// Retrieve all injury data from MongoDB
				const injuryData = await InjuryModel.find().lean().exec();
			
				// Convert the retrieved data to the desired format
				const formattedData: InjuryData = {};
				injuryData.forEach((entry: any) => {
					const participantName = entry.participantName;
					const injuries = entry.injuries.map((injury: any) => ({
						severity: injury.severity,
						duration: injury.duration,
						description: injury.description,
						timestamp: injury.timestamp
					}));
					formattedData[participantName] = injuries;
				});

				return formattedData;
			} catch (error) {
				console.error('Error loading injury data from MongoDB:', error);
				return {};
			}
		}
		const existingInjuryData = await loadInjuryDataFromMongoDB();

		if (participantData[user] && participantData[user].injuries.length > 0) {
			const activeInjuries = participantData[user].injuries.filter((injury: Injury) => {
				const injuryEndTime = injury.timestamp + injury.duration * 60000;
				return injuryEndTime > Date.now();
			});
	
			if (activeInjuries.length > 0) {
				console.log('User has an active injury.');
				const remainingInjuryDurations = activeInjuries.map((injury: Injury) => {
					const remainingInjuryDuration = Math.ceil((injury.timestamp + injury.duration * 60000 - Date.now()) / 60000);
					console.log('Injury:', injury);
					return `${remainingInjuryDuration} minutes`;
				});
				await chatClient.say(channel, `${user} has ${activeInjuries.length} active injury/injuries and needs to wait ${remainingInjuryDurations.join(', ')} to recover.`);
				return; // Exit the command if the user has an active injury
			} else {
				console.log('User\'s injury has healed.');
			}
		} else {
			console.log('User does not have any injuries.');
		}

		// Check if there are injuries in the database for the user attempting the command
		if (existingInjuryData[user] && existingInjuryData[user].length > 0) {
			console.log('User has injuries in the database:', existingInjuryData[user]);
			// Additional logic here if needed
		} else {
			console.log('User does not have any injuries in the database.');
		}


		// Perform validation and checks
		if (isNaN(betAmount)) { return chatClient.say(channel, 'Please provide a valid amount for the heist.'); }

		// Check if the amount is within the allowed range
		if (betAmount < 100 || betAmount > 5000) { return chatClient.say(channel, 'The heist minimum/maximum should be between 100 and 5000.'); }

		const zonesFilePath = './src/zones.json';
		const zonesJSON = fs.readFileSync(zonesFilePath, 'utf-8');
		const zones: Record<string, Zone> = JSON.parse(zonesJSON);

		const zoneNames = Object.values(zones).map(zone => zone.name).join(', ');
		if (args.length < 2) return chatClient.say(channel, `You must choose a zone to start the heist: ${zoneNames}`);

		// Check if there is a heist already in progress
		if (isHeistInProgress) { return chatClient.say(channel, 'A heist is already in progress. Please wait for the current heist to finish.'); }

		// Create a new object with lowercase keys
		const zonesLowercase: Record<string, Zone> = {};
		Object.keys(zones).forEach(key => {
			const zoneNameLowercase = key.split('_').join(' ').toLowerCase(); // Convert underscores to spaces
			zonesLowercase[zoneNameLowercase] = zones[key];
		});

		const zoneName = args.slice(1).join(' ').trim().toLowerCase();
		// Check if the lowercase zoneName exists in the zonesLowercase object
		if (!(zoneName in zonesLowercase)) {
			console.error('Specified zone does not exist');
			console.log('zoneName:', zoneName);
			console.log('zones:', zonesLowercase);
			await chatClient.say(channel, `The specified zone "${zoneName}" does not exist. Available zones are: ${Object.values(zones).map(zone => zone.name).join(', ')}`);
			return; // or handle the error appropriately
		}

		// Set heist in progress
		isHeistInProgress = true;

		const zoneDifficulty = zonesLowercase[zoneName].difficulty;

		// Add user to the participant list
		participants.push(user);

		// Add the user who started the heist to the participantData object
		if (!participantData[user]) {
			participantData[user] = { injuries: [] };
		}

		console.log('User:', user);
		console.log('Participant Data:', participantData);
		if (participantData[user]) {
			console.log('Participant Data for User:', participantData[user]);
			console.log('Injuries:', participantData[user]?.injuries);
		} else {
			console.log('Participant Data for User:', participantData[user]);
		}

		const userBalance = await UserModel.findOne({ username: msg.userInfo.userName });
		if (!userBalance) {
			throw new Error('User not found');
		}
		if (userBalance.balance === undefined) return;

		const updatedBalance = userBalance.balance - betAmount;
		await UserModel.updateOne({ username: msg.userInfo.userName }, { balance: updatedBalance });

		if (updatedBalance < 0) { return chatClient.say(channel, 'Insufficient balance for the heist.'); }

		// Send a heist start message with instructions to join
		await chatClient.say(channel, `A heist has been started by ${user}! Type !join to participate, you have 60 seconds to join!`);
		await sleep(1000);
		// Send a join confirmation message
		await chatClient.say(channel, `${user} has joined the heist!`);


		// Wait for the heist to start (e.g., 60 seconds)
		const delay = 10000;
		await new Promise((resolve) => setTimeout(resolve, delay));

		// Check if there are enough participants for the heist
		if (participants.length < 1) {
			await chatClient.say(channel, 'The heist requires a minimum of 1 participants. The heist has been canceled.');
			participants = [];
			isHeistInProgress = false;
			return;
		}

		// Calculate success rate
		let successRate = calculateSuccessRate(zoneDifficulty, participants);
		switch (zoneDifficulty) {
			case 'high':
				successRate += 0.2; // Increase success rate for high difficulty zones
				break;
			case 'moderate':
				successRate += 0.1; // Increase success rate for moderate difficulty zones
				break;
			case 'low':
				successRate -= 0.1; // Decrease success rate for low difficulty zones
				break;
			default:
				break;
		}

		// Determine if the heist is successful
		const isSuccessful = randomInt(1, 101) <= successRate * 100;

		// Determine the potential loot
		let loot: number = 0;
		let stolenItems: string[] = [];

		if (isSuccessful) {
			const lootResult = calculateLoot(amount, zoneDifficulty);
			loot = lootResult.totalAmount;
			stolenItems = lootResult.items;
		}

		//
		const numWinners = randomInt(1, participants.length + 1);
		const winningAmount = Math.floor(loot / numWinners);
		// Randomly select the winners
		const winners = participants.sort(() => 0.5 - Math.random()).slice(0, numWinners);

		// Construct the result message
		let resultMessage = `Heist initiated by ${user}.`;
		if (isSuccessful) {
			resultMessage += ' The heist was successful!';
			for (const winner of winners) {
				const winnerBalance = await UserModel.findOne({ username: winner });
				if (!winnerBalance) {
					throw new Error(`User ${winner} not found`);
				}
				if (winnerBalance.balance === undefined) return;
				// Create a new object with the updated balance
				const updatedBalance = winnerBalance.balance + winningAmount;
				await UserModel.updateOne({ username: winner }, { balance: updatedBalance });
			}

			// Check if there are any winners
			if (winners.length > 0) {
				resultMessage += ` Congratulations to the winners: ${winners.join(', ')}.`;
			} else {
				resultMessage += ' Unfortunately, no one won the heist.';
			}

			resultMessage += ` You managed to steal ${loot} units of loot. You stole the following items: ${stolenItems.join(', ')}`;
		} else {
			resultMessage += ' The heist failed. Better luck next time!';
			// Loop through each participant
			for (const participant of participants) {
				// Check for 50/50 chance of injury
				if (Math.random() <= 0.5) {
					const injurySeverity = determineInjurySeverity();
		
					// Assign the injury and get the injury details
					const injury = assignInjury(participant, injurySeverity);
		
					// Update participantData with the new injury
					if (participantData[participant]) {
						participantData[participant].injuries.push(injury);
					} else {
						participantData[participant] = { injuries: [injury] };
					}

					// Save updated injury data to MongoDB
					await saveInjuryDataToMongoDB(convertToInjuryData(participantData));
		
					// Log the updated participantData
					console.log('Updated ParticipantData:', participantData);
		
					// Construct the result message with injury details
					resultMessage += ` ${participant} received a ${injury.severity} injury and needs to recover for ${Math.floor(injury.duration / 60)} minutes. ${injury.description}`;
				}
			}
		}

		// Helper function to convert participantData to InjuryData
		function convertToInjuryData(participantData: { [participantName: string]: { injuries: Injury[] } }): InjuryData {
			const injuryData: InjuryData = {};
			for (const participantName in participantData) {
				injuryData[participantName] = participantData[participantName].injuries;
			}
			return injuryData;
		}

		// Send the result message to the chat
		await chatClient.say(channel, resultMessage);

		// Empty the participants array after the heist finishes
		participants = [];

		// Set heist in progress to false
		isHeistInProgress = false;

		// Delete expired injuries from MongoDB after the heist finishes
		await deleteExpiredInjuries();
	}
};

const minorInjuryDescriptions = [
	'twisted an ankle while jumping over a fence',
	'bumped their head on a low-hanging pipe',
	'got a nasty scratch from a stray cat during the escape',
	'Clipped their shoe on a loose brick, causing a slight ankle sprain.',
	'Accidentally triggered a hidden paint grenade, leaving them covered in colorful paint but unharmed.',
	'Improvised a solution using a bobby pin and managed to escape, but strained a finger in the process.',
	'Spotted a hidden security camera at the last moment, causing them to trip and bump their head.',
	'Narrowly avoided a laser grid activation, but brushed against it, causing a minor electric shock.'
];

const moderateInjuryDescriptions = [
	'strained a muscle during the getaway',
	'received a minor burn from a faulty security system',
	'was grazed by a bullet during a close call',
	'Miscalculated a code sequence and triggered a minor explosion, receiving burns from the hot fumes.',
	'Engaged in a struggle with a security guard, resulting in a pulled muscle and a few bruises.',
	'Took a risky jump to avoid capture, spraining an ankle on the landing.',
	'Used a smoke bomb to create a diversion, but inhaled some of the smoke and developed a cough.',
	'Escaped through a narrow passage, but scraped their arm on exposed pipes.'
];

const severeInjuryDescriptions = [
	'broke an arm trying to escape through a window',
	'sustained a concussion from a fall during the heist',
	'was shot in the leg during a shootout with security',
	'Attempted a daring escape from a moving vehicle, resulting in a broken leg from a fall.',
	'Sacrificed themselves to protect their team, taking a bullet in the shoulder during a shootout.',
	'Triggered a hidden trapdoor, falling through and sustaining serious injuries.',
	'Cornered by security forces, engaged in a hand - to - hand fight and received a severe concussion.',
	'Witnessed a teammate get captured, causing them to act recklessly and get seriously injured.'
];

// Function to assign injuries to a participant
function assignInjury(participant: string, severity: string): Injury {
	const injury = {
		severity: severity,
		duration: getInjuryDuration(severity),
		description: getRandomDescription(severity),
		timestamp: Date.now() // Add current timestamp
	};

	// Check if participant data exists, if not, create an empty array
	if (!injuryData[participant]) {
		injuryData[participant] = [];
	}

	// Add the injury to the participant's array in the JSON object
	injuryData[participant].push(injury);

	// Log the details of the injury for the participant
	console.log(`Assigned injury to participant ${participant}:`, injury);

	return injury;
}

// Function to save injury data to MongoDB
async function saveInjuryDataToMongoDB(data: InjuryData): Promise<void> {
	try {
		// Iterate through each participant's injury data and update it in MongoDB
		for (const participantName in data) {
			const injuries = data[participantName];
			if (injuries.length > 0) {
				// If there are injuries for the participant, update the existing injury
				const injury = injuries[0]; // Assuming there's only one injury per user
				await InjuryModel.findOneAndUpdate(
					{ participantName },
					{ injuries: [injury] }, // Update with the new injury
					{ upsert: true }
				);
			} else {
				// If there are no injuries for the participant, remove the existing injury
				await InjuryModel.findOneAndDelete({ participantName });
			}
		}
		console.log('Injury data saved to MongoDB');
	} catch (error) {
		console.error('Error saving injury data to MongoDB:', error);
	}
}
// Function to delete expired injuries from MongoDB
async function deleteExpiredInjuries(): Promise<void> {
	try {
		const now = Date.now();
		// Find and delete injuries where the injury end time has passed
		const injuries = await InjuryModel.find();
		for (const injuryData of injuries) {
			if (Array.isArray(injuryData.injuries)) {
				for (const injury of injuryData.injuries) {
					const expirationTime = injury.timestamp + (getInjuryDuration(injury.severity) || 0) * 60000;
					if (expirationTime < now) {
						await InjuryModel.deleteOne({ '_id': injuryData._id });
					}
				}
			}
		}
		console.log('Expired injuries deleted from MongoDB');
	} catch (error) {
		console.error('Error deleting expired injuries from MongoDB:', error);
	}
}

function getInjuryDuration(severity: string): number {
	switch (severity) {
		case 'minor':
			return 60; // 1 minute
		case 'moderate':
			return 300; // 5 minutes
		case 'severe':
			return 900; // 15 minutes
		default:
			// Handle unknown severity cases
			return 0;
	}
}

let descriptions: string[];
function getRandomDescription(severity: string): string {
	// Choose the appropriate description array based on severity
	switch (severity) {
		case 'minor':
			descriptions = minorInjuryDescriptions;
			break;
		case 'moderate':
			descriptions = moderateInjuryDescriptions;
			break;
		case 'severe':
			descriptions = severeInjuryDescriptions;
			break;
		default:
			// Handle unknown severity cases (optional: return empty string, default description, etc.)
			descriptions = []; // Example: returning an empty array for unknown severity
			break;
	}

	// If descriptions are available, choose a random one
	if (descriptions.length > 0) {
		const randomIndex = Math.floor(Math.random() * descriptions.length);
		return descriptions[randomIndex];
	} else {
		// Handle cases where no descriptions are available (optional: return default message)
		return 'An unexpected injury occurred.'; // Example: default message for unknown severity
	}
}
function getInjuryProbability(severity: string, /* difficulty: number */): number {
	// Set base probabilities based on severity (example)
	const baseProbabilities: {
		minor: number;
		moderate: number;
		severe: number;
		[key: string]: number; // Add index signature to allow for any string keys
	} = {
		minor: 0.7,
		moderate: 0.2,
		severe: 0.1,
	};

	// Adjust probabilities based on difficulty (example)
	// const difficultyModifier = difficulty / 10; // Increase chance of higher severity with higher difficulty

	return baseProbabilities[severity] /* + difficultyModifier */;
}
function determineInjurySeverity(/* difficulty: number */): string {
	const randomValue = Math.random();

	// Calculate cumulative probabilities for each severity
	let cumulativeProbability = 0;
	const severityProbabilities: Record<string, number> = {}; // Define its structure
	for (const severity of ['minor', 'moderate', 'severe']) {
		const probability = getInjuryProbability(severity, /* difficulty */);
		cumulativeProbability += probability;
		severityProbabilities[severity] = cumulativeProbability;
	}

	// Choose severity based on random value and cumulative probabilities
	for (const [severity, probability] of Object.entries(severityProbabilities)) {
		if (randomValue <= probability) {
			return severity;
		}
	}

	// Handle unexpected cases (optional: return default severity)
	return 'minor'; // Example: return "minor" in case of unexpected behavior
}

function calculateSuccessRate(zoneDifficulty: string, participants: string[]) {
	const maxSuccessRate = 0.9; // Maximum success rate (90%)
	const maxParticipants = 10; // Maximum number of participants that influence the success rate
	const participantFactor = participants.length / maxParticipants; // Calculate the factor based on the number of participants

	// Calculate the rate of increase per participant
	const rateOfIncrease = maxSuccessRate / maxParticipants;

	// Calculate the adjusted success rate based on the factor and rate of increase
	let adjustedRate = participantFactor * rateOfIncrease;

	// Adjust for difficulty
	switch (zoneDifficulty) {
		case 'high':
			adjustedRate += 0.2; // Increase success rate for high difficulty zones
			break;
		case 'moderate':
			adjustedRate += 0.1; // Increase success rate for moderate difficulty zones
			break;
		case 'low':
			adjustedRate -= 0.1; // Decrease success rate for low difficulty zones
			break;
		default:
			break;
	}

	// Limit the success rate to the maximum
	adjustedRate = Math.min(adjustedRate, maxSuccessRate);

	return adjustedRate;
}

function calculateLoot(amount: number, zoneDifficulty: string, playerInjury?: Injury): LootResult {
	const lootItems = Object.entries(lootValues);
	const numItems = randomInt(1, 9);
	let totalLootAmount = 0;
	const chosenItems: string[] = [];

	// Define the bonus multiplier based on difficulty
	let bonusMultiplier = 1;
	switch (zoneDifficulty) {
		case 'high':
			bonusMultiplier = 1.5; // High difficulty grants a 50% bonus
			break;
		case 'moderate':
			bonusMultiplier = 1.2; // Moderate difficulty grants a 20% bonus
			break;
			// Low difficulty has no bonus multiplier
		default:
			break;
	}

	if (playerInjury) {
		// Calculate the reduction in loot based on the severity of the injury
		let injuryPenalty = 0;
		switch (playerInjury.severity) {
			case 'minor':
				injuryPenalty = 500; // Example: reduce loot by a fixed amount for a minor injury
				break;
			case 'moderate':
				injuryPenalty = 1000; // Example: reduce loot by a larger amount for a moderate injury
				break;
			case 'severe':
				injuryPenalty = 2000; // Example: reduce loot by an even larger amount for a severe injury
				break;
			default:
				break;
		}
		// Apply the injury penalty to the total loot amount
		totalLootAmount = Math.max(0, totalLootAmount - injuryPenalty);
	}

	for (let i = 0; i < numItems; i++) {
		const [itemName, itemValue] = lootItems[randomInt(0, lootItems.length - 1)];
		const lootWorth = getValue(itemValue);

		// Apply the bonus multiplier to the loot worth
		const adjustedLootWorth = lootWorth * bonusMultiplier;

		// Ensure the player cannot go into negative loot
		if (totalLootAmount + adjustedLootWorth < 0) {
			totalLootAmount = 0;
			break; // Stop looting if the player would go into negative loot
		} else {
			totalLootAmount += adjustedLootWorth;
			chosenItems.push(itemName);
		}
	}

	let resultMessage = '';
	if (totalLootAmount === 0 && playerInjury) {
		resultMessage = `The heist was successful, but you sustained a ${playerInjury.severity} injury and couldn't gather any loot.`;
	}

	return {
		totalAmount: totalLootAmount,
		items: chosenItems,
		message: resultMessage,
	};
}

function getValue(item: number | Gems | Antique | Artwork | Cash): number {
	if (typeof item === 'number') {
		return item;
	} else if (typeof item === 'object') {
		const gemValues = Object.values(item) as number[];
		return gemValues.reduce((sum, value) => sum + value, 0);
	} else {
		throw new Error('Invalid loot item type.');
	}
}

// Handle the join command
(async () => {
	const chatClient = await getChatClient();
	chatClient.onMessage(async (channel: string, user: string, message: string, msg: ChatMessage) => {
		const command = message.trim().toLowerCase();

		if (command === '!join' && isHeistInProgress && !participants.includes(user)) {// needs to be tested to see if a user with an injury can join the heist.
			// Check if the user has any recorded injuries
			if (participantData[user] && participantData[user].injuries.length > 0) {
				const injury = participantData[user].injuries[0];
				const expirationTime = injury.timestamp + (getInjuryDuration(injury.severity) || 0) * 60000;
				const remainingInjuryDuration = Math.ceil((expirationTime - Date.now()) / 60000);
				if (remainingInjuryDuration > 0) {
					await chatClient.say(channel, `${user} has an injury and needs to wait ${remainingInjuryDuration} minutes to recover.`);
					return;
				}
			}

			// Continue with the join process if the user is eligible
			const userBalance = await UserModel.findOne({ username: msg.userInfo.userName });

			if (!userBalance) {
				throw new Error('User not found');
			}
			if (userBalance.balance === undefined) return;
			if (userBalance.balance < betAmount) {
				await chatClient.say(channel, 'Insufficient balance to join the heist.');
				return;
			}

			userBalance.balance -= betAmount;
			await userBalance.save();

			participants.push(user);

			// Add the user to the participantData object
			if (!participantData[user]) {
				participantData[user] = { injuries: [] };
			}
			await chatClient.say(channel, `${user} has joined the heist!`);
		}
	});
})();
export default heist;