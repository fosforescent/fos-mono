# Fosforescent

> A distributed, collaborative workflow system that combines human and AI inputs through a visual graph-based interface.

**⚠️ Project Status: Early Development**  
*This project is in early stages of development. Most features described here represent the design vision and roadmap, not current functionality.*

## What Is Fosforescent?

Fosforescent aims to be a new way to organize cooperative work and resources. It's designed as a visual workflow system built on a dependently typed functional dataflow language using term graph rewriting. In simpler terms: it will let you create, visualize, and collaborate on complex projects by directly manipulating a graph of tasks, subtasks, and resources.

## Planned Features

- **Visual Graph Editor** - Directly manipulate task dependencies and workflows
- **Resource Allocation** - Track and allocate money, time, tools, and materials
- **Collaborative Decision Making** - Propose, vote on, and implement changes
- **Distributed Architecture** - Content-addressable graph nodes shared via DHT
- **Extensible Primitives** - Define custom evaluation handlers and effects

## Current Implementation Status

- ✅ Basic graph data structure implementation
- ✅ Node content addressing via cryptographic hashing
- 🔄 Visual editor
- 🔄 Primitive node types and operations
- 🔄 First iteration of store mechanism
- ❌ Distributed node synchronization
- ❌ Resource allocation system
- ❌ Collaborative features

## Use Cases

- **Personal Projects** - Plan weddings, renovations, or other complex tasks
- **Community Initiatives** - Pool resources for neighborhood improvements
- **Cooperative Businesses** - Manage distributed teams and shared ownership
- **Decentralize Service Marketplace** - Eventually Fosforescent plans to connect providers with requesters through structured workflows and use platform fees to pay contributors for development of the platform

## Technical Foundation

Fosforescent combines concepts from:
- Content-addressable code (like Unison)
- Graph-based programming models
- Dependently typed functional languages
- Distributed consensus systems

The system uses cryptographic hashing to identify subgraphs.  In the future for the decentralized version, the plan is for nodes to be distributed via a DHT protocol. "Evaluation agent workers" read graphs and make asynchronous updates, broadcasting relevant changes to peers.

## Vision

Fosforescent aims to become the foundation for a new kind of digital cooperation—where complex workflows, resource allocation, and decision-making can happen transparently and asynchronously across distributed teams and communities.

In a functional programming langauge, everything is a function.  Even data can be modeled as a series of data constructors.  Fosforescent takes that a step further where everything is a task. 

## Contributing

I'm actively seeking contributors to help bring this vision to life! The project is in early stages with a solid conceptual foundation, but there's a lot of work to be done implementing the core features. Contributors with interest and/or experience in any of these areas are especially welcome:

- Graph-based programming languages
- Dependent type systems
- Distributed systems and DHTs
- Visual programming interfaces
- Collaborative editing

If you're interested in helping push this project forward, please reach out at info@fosforescent.com