'use strict';
const axios = require("axios");
const util = require('util');
const { Client } = require('pg');

// Global Variables
const tokenURL = `${process.env.authenticationUrl}/v2/token`;

/*
 * POST Handlers for various routes
 */
exports.edit = function (req, res) {
    res.status(200).send('Edit');
};

exports.save = async function (req, res) {
    try {
        const payload = req.body;
        await saveToDatabase(payload);
        res.status(200).send('Save');
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).send('Erro ao salvar dados.');
    }
};

exports.execute = async function (req, res) {
    try {

        const inArguments = req.body.inArguments[0];
        const contactKey = inArguments.contactKey;
        const APIEventKey = inArguments.selectedJourneyAPIEventKey;
        const data = inArguments.payload;
        const uuid = inArguments.uuid;

        const token = await retrieveToken();
        const response = await triggerJourney(token, contactKey, APIEventKey, data);

        const responsePayload = {
            uuid: uuid,
            contactKey: contactKey,
            triggerDate: new Date(),
            status: response.status,
            errorLog: response.error ? response.error.message : null
        };

        await saveToDatabase(responsePayload);

        res.status(200).send('Execute');
    } catch (error) {
        console.error('Error executing journey:', error);

        const responsePayload = {
            uuid: req.body.inArguments[0].uuid,
            contactKey: req.body.inArguments[0].contactKey,
            triggerDate: new Date(),
            status: 'Error',
            errorLog: error.message
        };

        try {
            await saveToDatabase(responsePayload);
        } catch (dbError) {
            console.error('Error saving error log to database:', dbError);
        }

        res.status(200).send('Execute'); // Ensure the journey continues
    }
};


exports.publish = function (req, res) {
    res.status(200).send('Publish');
};

exports.validate = function (req, res) {
    res.status(200).send('Validate');
};

exports.stop = function (req, res) {
    res.status(200).send('Stop');
};

/*
 * Function to retrieve an access token
 */
async function retrieveToken() {
    try {
        const response = await axios.post(tokenURL, {
            grant_type: 'client_credentials',
            client_id: process.env.clientId,
            client_secret: process.env.clientSecret
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error retrieving token:', error);
        throw error;
    }
}

/*
 * Function to trigger a journey
 */
async function triggerJourney(token, contactKey, APIEventKey, data) {
    const triggerUrl = `${process.env.restBaseURL}/interaction/v1/events`;
    const eventPayload = {
        ContactKey: contactKey,
        EventDefinitionKey: APIEventKey,
        Data: data
    };
    try {
        const response = await axios.post(triggerUrl, eventPayload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return { status: 'Success', error: null };
    } catch (error) {
        console.error('Error triggering journey:', error);
        return { status: 'Error', error: error };
    }
}

/*
 * GET Handler for /journeys route
 */
exports.getJourneys = async function (req, res) {
    try {
        const token = await retrieveToken();
        const journeys = await fetchJourneys(token);
        res.status(200).json(journeys);
    } catch (error) {
        console.error('Error retrieving journeys:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

/*
 * Function to retrieve journeys
 */
async function fetchJourneys(token) {
    const journeysUrl = `${process.env.restBaseURL}/interaction/v1/interactions/`;

    try {
        const response = await axios.get(journeysUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching journeys:', error);
        throw error;
    }
}

/*
 * Handler to get activity data by UUID
 */
exports.getActivityByUUID = async function (req, res) {
    const uuid = req.params.uuid;

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    await client.connect();

    const query = 'SELECT * FROM activity_data WHERE uuid = $1';
    const values = [uuid];

    try {
        const result = await client.query(query, values);
        if (result.rows.length > 0) {
            res.json(result.rows); // Return all matching rows
        } else {
            res.status(404).send('Activity not found');
        }
    } catch (err) {
        console.error('Error retrieving activity data from database:', err.stack);
        res.status(500).send('Internal Server Error');
    } finally {
        await client.end();
    }
}


/*
 * Function to save data to the database
 */
async function saveToDatabase(data) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    await client.connect();

    // Ensure the table exists
    await client.query(`
        CREATE TABLE IF NOT EXISTS activity_data (
            id SERIAL PRIMARY KEY,
            uuid VARCHAR(36) NOT NULL,
            contact_key VARCHAR(255) NOT NULL,
            trigger_date TIMESTAMP NOT NULL,
            status VARCHAR(50) NOT NULL,
            error_log TEXT
        )
    `);

    const query = 'INSERT INTO activity_data(uuid, contact_key, trigger_date, status, error_log) VALUES($1, $2, $3, $4, $5)';
    const values = [data.uuid, data.contactKey, data.triggerDate, data.status, data.errorLog];

    try {
        await client.query(query, values);
    } catch (err) {
        console.error('Error saving data to database:', err.stack);
    } finally {
        await client.end();
    }
}
