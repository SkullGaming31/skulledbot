import { Document, Schema, model } from 'mongoose';

export interface IToken extends Document {
	user_id: string;
	login: string;
	access_token: string;
	refresh_token: string;
	scope: string[];
	expires_in: number;
	obtainmentTimestamp: number;
}

const tokenSchema = new Schema<IToken>({
	user_id: {
		type: String,
		unique: true,
		required: true
	},
	login: {
		type: String,
		required: true
	},
	access_token: {
		type: String,
		required: true
	},
	refresh_token: {
		type: String,
		required: true
	},
	scope: {
		type: [String],
		required: true
	},
	expires_in: {
		type: Number,
		required: true
	},
	obtainmentTimestamp: {
		type: Number,
		required: true
	},
});
// obtainmentTimestamp is saved in seconds same with expires_in

export const TokenModel = model<IToken>('usertokens', tokenSchema);