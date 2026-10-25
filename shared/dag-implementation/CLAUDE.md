# DAG Implementation - CLAUDE.md

## Directory Summary

Responsible for the core graph: content-addressable storage and immutable nodes. Evaluation belongs above the store, in `shared/sync/`.

**Key Design Documents:**
- `../../docs/language-design.md` - Full language specification
- `../../docs/implementation-roadmap.md` - Implementation phases (especially Phases 1-3, 5-6)

## Content Addressing

- Identical content must produce identical CIDs.
- Cids must carry the data version (`FOS_DATA_VERSION` in `shared/version.ts`). Data in another version must be refused, not migrated, and has to be reset. See `docs/cid-versioning.md`.

## TODOs

### High Priority (Phase 1-2)
- [ ] Add TYPE, PI, SIGMA, EQ, REFL, SYMBOL primitives to primitive-node.ts
- [ ] Add HOLE, CONTINUATION primitives
- [ ] Add SCOPE, BINDING, RULE primitives
- [ ] Add BOX, DIAMOND, MODALITY primitives
- [ ] Add ACTOR, CAPABILITY, EFFECT primitives
- [ ] Implement `checkType()` in store.ts
- [ ] Implement `inferType()` in store.ts
- [ ] Update PrimitiveAliases type with new primitives

### Medium Priority (Phase 3, 5-6)
- [ ] Create scope.ts with FosScope class
- [ ] Create hole.ts with HoleManager class
- [ ] Create modality.ts with ModalityManager class
- [ ] Create actor.ts with ActorRegistry class

### Lower Priority
- [ ] Add distributed peer synchronization
- [ ] Performance optimization for large graphs
