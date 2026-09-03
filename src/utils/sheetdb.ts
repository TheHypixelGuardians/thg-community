// This utility is used to fetch and input data to the sheetdb api

import axios from 'axios';

const apiurl = process.env.SHEETDB_API_URL;
const apikey = process.env.SHEETDB_API_KEY;

// Use typescript to type the data for multiple types of sheets e.g moderation
// moderation sheet
export interface ModerationData {
  User: string;
  Moderator: string;
  Reason: string;
  Type: string;
  Date: String;
  Expire?: String;
  Expired?: boolean;
}
// SheetID is an optional variable
export const fetchData = async (sheetId?: string): Promise<ModerationData[]> => {
  try {
    const url = sheetId ? `${apiurl}?sheet=${sheetId}` : (apiurl || '');
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${apikey}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching data from sheetdb:', error);
    throw error;
  }
};

export const inputData = async (sheetId: string, data: ModerationData) => {
  try {
    const response = await axios.post(`${apiurl}?sheet=${sheetId}`, [data], {
      headers: {
        Authorization: `Bearer ${apikey}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error inputting data to sheetdb:', error);
    throw error;
  }
};

/**
 * Checks for expired punishments and updates the spreadsheet accordingly
 * @param sheetId - The sheet ID to check for expired punishments
 */
export const checkAndUpdateExpiredPunishments = async (sheetId: string): Promise<void> => {
  try {
    // Fetch all moderation data from the spreadsheet
    const allData = await fetchData(sheetId);
    const currentTime = new Date();

    // Filter for records that have expired but aren't marked as expired yet
    const expiredRecords = allData.filter((record) => {
      if (!record.Expire || record.Expired === true) {
        return false; // Skip records without expiry dates or already marked as expired
      }

      // Properly parse the expiry date as a string
      const expireDate = new Date(String(record.Expire));
      return !isNaN(expireDate.getTime()) && expireDate <= currentTime; // Record has expired only if expiry date is valid
    });

    console.log(`Found ${expiredRecords.length} expired punishments to update`);

    // Update each expired record
    for (const record of expiredRecords) {
      try {
        // Update the record to mark it as expired
        const updatedRecord = { ...record, Expired: true };
        
        // Note: This assumes the API supports updating existing records
        // You might need to use a different endpoint or method depending on your SheetDB setup
        await axios.put(`${apiurl}?sheet=${sheetId}`, updatedRecord, {
          headers: {
            Authorization: `Bearer ${apikey}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`Updated expired punishment for user: ${record.User}, type: ${record.Type}`);
      } catch (error) {
        console.error(`Error updating expired punishment for user ${record.User}:`, error);
        // Continue with other records even if one fails
      }
    }

    if (expiredRecords.length > 0) {
      console.log(`Successfully updated ${expiredRecords.length} expired punishments`);
    }
  } catch (error) {
    console.error('Error checking and updating expired punishments:', error);
    throw error;
  }
};
