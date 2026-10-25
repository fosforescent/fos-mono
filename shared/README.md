# Fosforescent

> A distributed, collaborative workflow system that combines human and AI inputs through a visual graph-based interface.

## What Is Fosforescent?

Fosforescent aims to be a new way to organize cooperative work and resources. It's designed as a visual workflow system built on a dependently typed functional dataflow language using term graph rewriting. In simpler terms: it will let you create, visualize, and collaborate on complex projects by directly manipulating a graph of tasks, subtasks, and resources.

## Planned Features

- **Visual Graph Editor** - Directly manipulate task dependencies and workflows
- **Resource Allocation** - Track and allocate money, time, tools, and materials
- **Collaborative Decision Making** - Propose, vote on, and implement changes
- **Distributed Architecture** - Content-addressable graph nodes shared via DHT
- **Extensible Primitives** - Define custom evaluation handlers and effects

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

Subgraphs should be identified by cryptographic hash. In the decentralized version, the plan is for nodes to be distributed via a DHT protocol. "Evaluation agent workers" read graphs and make asynchronous updates, broadcasting relevant changes to peers.

## Vision

Fosforescent aims to become the foundation for a new kind of digital cooperation—where complex workflows, resource allocation, and decision-making can happen transparently and asynchronously across distributed teams and communities.

In a functional programming langauge, everything is a function.  Even data can be modeled as a series of data constructors.  Fosforescent takes that a step further where everything is a task. 

## Contributing

I'm seeking contributors to help bring this vision to life! Contributors with interest and/or experience in any of these areas are especially welcome:

- Graph-based programming languages
- Dependent type systems
- Distributed systems and DHTs
- Visual programming interfaces
- Collaborative editing

If you're interested in helping push this project forward, please reach out at info@fosforescent.com
