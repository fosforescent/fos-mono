import { config } from 'dotenv';
// Load environment variables from root .env file
config({ path: '../.env' });

// Import Qdrant functions from local infra package
import { 
  initializeCollection, 
  batchUpsertDocuments, 
  getCollectionInfo,
  deleteDocument 
} from './qdrant';

// Sample graph nodes that would be created during development
const sampleNodes = [
  {
    nodeId: 'start_root_alias',
    content: 'Root node for Fosforescent workflow system. This is the starting point for all user interactions.',
    metadata: {
      type: 'root',
      category: 'system',
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'file_operations_workflow',
    content: 'File Operations Workflow - A comprehensive workflow for handling file system operations including reading, writing, listing directories, and managing file permissions.',
    metadata: {
      type: 'workflow',
      category: 'file_system',
      tools: ['read_file', 'write_file', 'list_directory'],
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'web_search_workflow', 
    content: 'Web Search and Content Extraction Workflow - Tools for searching the web, extracting content from webpages, and processing online information for analysis.',
    metadata: {
      type: 'workflow',
      category: 'web_search',
      tools: ['web_search', 'get_webpage_content'],
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'database_operations_workflow',
    content: 'Database Operations Workflow - Execute SQL queries, manage database connections, and perform data analysis operations across different database systems.',
    metadata: {
      type: 'workflow', 
      category: 'database',
      tools: ['execute_query'],
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'ai_text_processing_workflow',
    content: 'AI Text Processing Workflow - Advanced text analysis including sentiment analysis, topic extraction, text summarization, and multi-language translation capabilities.',
    metadata: {
      type: 'workflow',
      category: 'ai_processing',
      tools: ['analyze_text', 'translate_text'],
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'project_planning_template',
    content: 'Project Planning Template - A structured approach to project planning including task breakdown, timeline estimation, resource allocation, and milestone tracking.',
    metadata: {
      type: 'template',
      category: 'planning',
      complexity: 'intermediate',
      estimatedTime: '2-4 hours',
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'data_analysis_pipeline',
    content: 'Data Analysis Pipeline - Comprehensive data processing workflow including data ingestion, cleaning, transformation, analysis, and visualization reporting.',
    metadata: {
      type: 'pipeline',
      category: 'data_science',
      stages: ['ingestion', 'cleaning', 'analysis', 'reporting'],
      complexity: 'advanced',
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'user_onboarding_flow',
    content: 'User Onboarding Flow - Step-by-step process for new user registration, profile setup, feature introduction, and initial workflow creation.',
    metadata: {
      type: 'flow',
      category: 'user_experience',
      steps: ['registration', 'profile_setup', 'feature_tour', 'first_workflow'],
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'api_integration_guide',
    content: 'API Integration Guide - Best practices for integrating external APIs, handling authentication, rate limiting, error handling, and data transformation.',
    metadata: {
      type: 'guide',
      category: 'development',
      topics: ['authentication', 'rate_limiting', 'error_handling'],
      difficulty: 'intermediate',
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'automated_testing_workflow',
    content: 'Automated Testing Workflow - Comprehensive testing strategy including unit tests, integration tests, end-to-end testing, and continuous integration setup.',
    metadata: {
      type: 'workflow',
      category: 'testing',
      testTypes: ['unit', 'integration', 'e2e'],
      tools: ['jest', 'playwright', 'ci_cd'],
      createdBy: 'system',
      seedCreated: true
    }
  }
];

// Tool-specific examples that demonstrate different capabilities
const toolExamples = [
  {
    nodeId: 'read_file_example',
    content: 'Example: Reading configuration files - Demonstrates how to safely read and parse configuration files, handle missing files, and validate file contents.',
    metadata: {
      type: 'example',
      tool: 'read_file',
      category: 'file_system',
      useCase: 'configuration_management',
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'web_search_example',
    content: 'Example: Research and fact-checking - Shows how to search for current information, verify facts across multiple sources, and compile research findings.',
    metadata: {
      type: 'example',
      tool: 'web_search',
      category: 'research',
      useCase: 'fact_checking',
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'analyze_text_example',
    content: 'Example: Customer feedback analysis - Demonstrates sentiment analysis on customer reviews, extracting key themes, and generating actionable insights.',
    metadata: {
      type: 'example',
      tool: 'analyze_text',
      category: 'business_intelligence',
      useCase: 'customer_feedback',
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'translate_text_example',
    content: 'Example: Multi-language content localization - Shows how to translate content while preserving context, handling technical terms, and maintaining brand voice.',
    metadata: {
      type: 'example',
      tool: 'translate_text',
      category: 'localization',
      useCase: 'content_translation',
      createdBy: 'system',
      seedCreated: true
    }
  }
];

// User profile nodes based on seed data
const userProfiles = [
  {
    nodeId: 'admin_profile_node',
    content: 'Admin User Profile - System administrator with full access to all features, user management capabilities, and system configuration permissions.',
    metadata: {
      type: 'user_profile',
      email: 'admin@fosforescent.com',
      role: 'admin',
      capabilities: ['user_management', 'system_config', 'advanced_tools'],
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'developer_profile_node',
    content: 'Developer User Profile - Software developer with access to development tools, API documentation, and advanced workflow creation capabilities.',
    metadata: {
      type: 'user_profile',
      email: 'developer@fosforescent.com',
      role: 'user',
      specialization: 'software_development',
      interests: ['apis', 'automation', 'testing'],
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'test_user1_profile_node',
    content: 'Test User 1 Profile - General user profile for testing standard user workflows, basic tool access, and user experience validation.',
    metadata: {
      type: 'user_profile',
      email: 'user1@fosforescent.com',
      role: 'user',
      experience_level: 'beginner',
      createdBy: 'system',
      seedCreated: true
    }
  },
  {
    nodeId: 'test_user2_profile_node',
    content: 'Test User 2 Profile - Intermediate user profile for testing advanced workflows, collaboration features, and power user capabilities.',
    metadata: {
      type: 'user_profile',
      email: 'user2@fosforescent.com',
      role: 'user',
      experience_level: 'intermediate',
      createdBy: 'system',
      seedCreated: true
    }
  }
];

async function main() {
  try {
    console.log('Starting Qdrant seed process...');
    
    // Debug environment loading
    console.log('Environment check:');
    console.log('- OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
    console.log('- OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0);
    console.log('- OPENAI_API_KEY value:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 15)}...` : 'not set');
    console.log('- OPENAI_API_KEY ends with:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.slice(-10) : 'not set');
    console.log('- QDRANT_URL:', process.env.QDRANT_URL || 'not set');
    
    // Check for required environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY environment variable is required for generating embeddings. ' +
        'Please set it in your .env file.'
      );
    }
    
    if (process.env.OPENAI_API_KEY.length < 10) {
      throw new Error(
        'OPENAI_API_KEY appears to be invalid (too short). ' +
        'Please check your .env file for a valid OpenAI API key.'
      );
    }
    
    if (!process.env.QDRANT_URL && !process.env.QDRANT_API_KEY) {
      console.warn('⚠️  QDRANT_URL not set, using default: http://localhost:6333');
    }
    
    console.log('✅ Environment variables validated');
    
    // Initialize collection (this is also done in backend startup)
    await initializeCollection();
    console.log('✅ Qdrant collection initialized');

    // Clear any existing seed data
    console.log('Clearing existing seed data...');
    const allSeedNodes = [...sampleNodes, ...toolExamples, ...userProfiles];
    
    for (const node of allSeedNodes) {
      try {
        await deleteDocument(node.nodeId);
      } catch (error: any) {
        // Ignore errors for non-existent documents during cleanup
        if (error?.status === 404 || error?.data?.status?.error?.includes('not found')) {
          console.log(`Document ${node.nodeId} doesn't exist, skipping...`);
        } else {
          console.warn(`Failed to delete ${node.nodeId}:`, error?.message || error);
        }
      }
    }

    // Seed sample workflow nodes
    console.log('Seeding sample workflow nodes...');
    await batchUpsertDocuments(sampleNodes);
    console.log(`✅ Inserted ${sampleNodes.length} sample workflow nodes`);

    // Seed tool examples
    console.log('Seeding tool examples...');
    await batchUpsertDocuments(toolExamples);
    console.log(`✅ Inserted ${toolExamples.length} tool example nodes`);

    // Seed user profiles
    console.log('Seeding user profile nodes...');
    await batchUpsertDocuments(userProfiles);
    console.log(`✅ Inserted ${userProfiles.length} user profile nodes`);

    // Display collection info
    const collectionInfo = await getCollectionInfo();
    console.log('📊 Collection info:', {
      name: collectionInfo.result.collection_name,
      vectorsCount: collectionInfo.result.vectors_count,
      status: collectionInfo.result.status
    });

    console.log('🎉 Qdrant seed completed successfully!');
    console.log(`Total documents seeded: ${allSeedNodes.length}`);

  } catch (error) {
    console.error('❌ Qdrant seed failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { main as seedQdrant, sampleNodes, toolExamples, userProfiles };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}