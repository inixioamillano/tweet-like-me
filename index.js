var Twit = require('twit');
const mongoose = require('mongoose');
const MarkovGen = require('markov-generator');

require("dotenv").config();

const { API_KEY, API_SECRET_KEY, ACCESS_TOKEN, ACCESS_TOKEN_SECRET, SCREEN_NAME, DB_URL } = process.env;

const tweetSchema = new mongoose.Schema({
    text: String
});

const Tweet = mongoose.model('Tweet', tweetSchema);

const twitter = new Twit({
    access_token: ACCESS_TOKEN,
    access_token_secret: ACCESS_TOKEN_SECRET,
    consumer_key: API_KEY,
    consumer_secret: API_SECRET_KEY,
});

function getTweets(q = `from:${SCREEN_NAME}`) {    
    console.log(q);
    twitter.get('search/tweets', {q, count: 100}, async (err, data, response) => {
        if (err) {
            console.log(err);
            return;
        }
        const tweets = data.statuses.map(s => {
            return new Tweet({text: s.text});
        });
        Tweet.insertMany(tweets);
        await getTweets(data.search_metadata.next_results);
    });
}

const sendTweet = async () => {
    const tweets = await Tweet.find();
    const input = tweets.map(t => t.text);
    const markov = new MarkovGen({
        input,
        minLenght: 10
    });
    let post = '';
    while (post.length > 280 || post.length === 0) {
        post = markov.makeChain().replace("RT ", "");
    }
    twitter.post('statuses/update', { status: post }, (err, data, res) => {
        console.log(err);
    });
}

mongoose.connect(DB_URL, {useNewUrlParser: true, useUnifiedTopology: true}).then(async (db) => {
    const learnt = await Tweet.count();
    if (learnt === 0) {
        getTweets();
    } else {
        console.log(`I've learnt ${learnt} tweets`);
    }
    sendTweet();
    setInterval(sendTweet, 60 * 60 * 1000);
    const stream = twitter.stream('statuses/sample', {screen_name: SCREEN_NAME});
    stream.on('tweet', (tweet) => {
        const newTweet = new Tweet({text: tweet.text});
        newTweet.save();
    })
});
