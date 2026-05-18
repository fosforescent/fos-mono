import { config } from 'dotenv';
config({ path: '../.env' });

import { 
  initializeCollection, 
  deleteDocument,
  getCollectionInfo
} from './qdrant';

async function testQdrant() {
  try {
    console.log('Testing Qdrant connection...');
    
    // Test collection
    await initializeCollection();
    console.log('✅ Collection initialized');
    
    // Test delete with non-existent document
    console.log('Testing delete function...');
    try {
      await deleteDocument('nonexistent_test_id');
      console.log('✅ Delete succeeded (or document didn\'t exist)');
    } catch (error: any) {
      console.log('Delete error details:', {
        status: error?.status,
        message: error?.message,
        data: error?.data
      });
    }
    
    // Get collection info
    const info = await getCollectionInfo();
    console.log('Collection info:', {
      name: info.result.collection_name,
      vectorsCount: info.result.vectors_count,
      status: info.result.status
    });
    
    console.log('✅ Qdrant test completed');
    
  } catch (error) {
    console.error('❌ Qdrant test failed:', error);
  }
}

testQdrant();