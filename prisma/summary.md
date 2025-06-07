# Prisma Directory Summary

## Purpose
Database schema definition, migrations, and seed data management for the Fosforescent PostgreSQL database using Prisma ORM with pgvector extension for semantic search.

## Dependencies
- **Prisma Client**: TypeScript-safe database client generator
- **PostgreSQL**: Primary database with pgvector extension
- **Environment Variables**: DATABASE_URL for connection configuration

## Data Inputs

### Schema Definition
- **Model Definitions**: Database table structures and relationships
- **Field Types**: PostgreSQL data types including JSON, DateTime, vectors
- **Constraints**: Primary keys, foreign keys, unique constraints, indexes
- **Default Values**: Field defaults and auto-incremented values

### Seed Data
- **Initial Users**: Default user accounts for development
- **Example Workflows**: Sample graph nodes and relationships
- **Configuration Data**: System configuration and defaults
- **Test Data**: Development and testing datasets

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string
- **Binary Targets**: Deployment platform specifications
- **Provider Settings**: Database provider configuration

## Data Outputs

### Generated Client
- **TypeScript Client**: Type-safe database access layer
- **Model Types**: Generated TypeScript interfaces for all models
- **Query Builder**: Fluent API for database operations
- **Migration Files**: Database schema change scripts

### Database Schema
- **Tables**: Physical database tables with proper constraints
- **Indexes**: Performance optimization indexes
- **Relationships**: Foreign key constraints and joins
- **Extensions**: pgvector extension for vector similarity search

### Data Management
- **Seeded Records**: Initial database content for development
- **Migration History**: Schema evolution tracking
- **Type Safety**: Compile-time database query validation

## Events Handled
- **Schema Changes**: Database migrations and rollbacks
- **Data Seeding**: Initial and test data population
- **Client Generation**: TypeScript client regeneration
- **Vector Extension**: pgvector extension initialization

## Data Transformations
- **Schema Definition → Database Tables**: Prisma schema converted to PostgreSQL DDL
- **TypeScript Models → Database Records**: Object-relational mapping
- **Seed Scripts → Database Content**: Initialization data insertion
- **Migrations → Schema Updates**: Version-controlled schema evolution

## Database Models

### User Management
- **UserModel**: User accounts with authentication and subscription data
- **UserEventModel**: Authentication and user activity logging
- **ClientErrorModel**: Client-side error tracking and debugging

### Email System
- **InboundEmailModel**: Received emails and contact form submissions
- **OutboundEmailModel**: Outgoing emails with template information
- **OutboundDeliveryAttemptModel**: Email delivery status tracking

### Graph System
- **FosNodeModel**: Content-addressable graph nodes with JSON data
- **FosNodeUserAccessLinkModel**: User access permissions for nodes
- **NodeVectorModel**: Vector embeddings for semantic search

### Subscription System
- **Stripe Integration**: Customer IDs, session IDs, subscription status
- **API Usage Tracking**: Call limits, usage counts, allocation management
- **Payment Processing**: Subscription status and billing integration

## Vector Search Features
- **pgvector Extension**: Vector similarity search capabilities
- **Embedding Storage**: High-dimensional vectors for semantic search
- **Similarity Queries**: Cosine distance calculations for search
- **Vector Indexing**: Optimized vector search performance

## Data Relationships
- **User-Node Access**: Many-to-many user permissions for graph nodes
- **Email Delivery**: One-to-many email delivery attempt tracking
- **User Events**: One-to-many user activity logging
- **Graph Ownership**: User root nodes and access hierarchies

## Development Features
- **Type Safety**: Full TypeScript integration with database
- **Migration System**: Version-controlled schema changes
- **Seed Data**: Reproducible development environment setup
- **Multi-Platform**: Support for various deployment targets

## Performance Optimizations
- **Indexed Fields**: Strategic indexing for query performance
- **JSON Fields**: Flexible data storage for graph content
- **Vector Indexes**: Optimized similarity search performance
- **Foreign Key Constraints**: Data integrity and join optimization