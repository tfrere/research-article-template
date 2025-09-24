#!/usr/bin/env node

import { config } from 'dotenv';
import { Client } from '@notionhq/client';

// Load environment variables from .env file
config();

const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

async function debugPageProperties() {
    const pageId = '27877f1c9c9d804d9c82f7b3905578ff';

    try {
        console.log('🔍 Debugging page properties...');
        console.log(`📄 Page ID: ${pageId}`);

        const page = await notion.pages.retrieve({ page_id: pageId });
        
        console.log('\n📋 Available properties:');
        console.log('========================');
        
        for (const [key, value] of Object.entries(page.properties)) {
            console.log(`\n🔹 ${key}:`);
            console.log(`   Type: ${value.type}`);
            
            switch (value.type) {
                case 'title':
                    console.log(`   Value: "${value.title.map(t => t.plain_text).join('')}"`);
                    break;
                case 'rich_text':
                    console.log(`   Value: "${value.rich_text.map(t => t.plain_text).join('')}"`);
                    break;
                case 'people':
                    console.log(`   People: ${value.people.map(p => p.name || p.id).join(', ')}`);
                    break;
                case 'select':
                    console.log(`   Value: ${value.select?.name || 'null'}`);
                    break;
                case 'multi_select':
                    console.log(`   Values: [${value.multi_select.map(s => s.name).join(', ')}]`);
                    break;
                case 'date':
                    console.log(`   Value: ${value.date?.start || 'null'}`);
                    break;
                case 'checkbox':
                    console.log(`   Value: ${value.checkbox}`);
                    break;
                case 'url':
                    console.log(`   Value: ${value.url || 'null'}`);
                    break;
                case 'email':
                    console.log(`   Value: ${value.email || 'null'}`);
                    break;
                case 'phone_number':
                    console.log(`   Value: ${value.phone_number || 'null'}`);
                    break;
                case 'number':
                    console.log(`   Value: ${value.number || 'null'}`);
                    break;
                case 'created_time':
                    console.log(`   Value: ${value.created_time}`);
                    break;
                case 'created_by':
                    console.log(`   Value: ${value.created_by?.id || 'null'}`);
                    break;
                case 'last_edited_time':
                    console.log(`   Value: ${value.last_edited_time}`);
                    break;
                case 'last_edited_by':
                    console.log(`   Value: ${value.last_edited_by?.id || 'null'}`);
                    break;
                default:
                    console.log(`   Value: ${JSON.stringify(value, null, 2)}`);
            }
        }
        
        console.log('\n✅ Properties debug completed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugPageProperties();
