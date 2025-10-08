#!/usr/bin/env node

import { config } from 'dotenv';
import { Client } from '@notionhq/client';

// Load environment variables from .env file
config();

const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

async function testAccess() {
    const pageId = '27877f1c9c9d804d9c82f7b3905578ff';

    try {
        console.log('🔍 Testing access to Notion page...');
        console.log(`📄 Page ID: ${pageId}`);

        const response = await notion.pages.retrieve({ page_id: pageId });

        console.log('✅ Access successful!');
        console.log(`📝 Page title: ${response.properties.title?.title?.[0]?.text?.content || 'No title'}`);
        console.log(`📅 Created: ${response.created_time}`);
        console.log(`👤 Created by: ${response.created_by.id}`);

    } catch (error) {
        console.error('❌ Access failed:', error.message);

        if (error.code === 'unauthorized') {
            console.log('\n💡 Solutions:');
            console.log('1. Check that your NOTION_TOKEN is correct');
            console.log('2. Make sure the page is shared with your integration');
            console.log('3. Verify that the integration has the right permissions');
        }
    }
}

testAccess();
