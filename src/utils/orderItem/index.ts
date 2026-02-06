/**
 * OrderItem Utilities Module
 *
 * This module provides utilities for handling OrderItems:
 * - UUID resolution (GraphQL UUIDs → Database IDs)
 *
 * Module Structure:
 * - types.ts: Shared TypeScript type definitions
 * - resolvers.ts: UUID to database ID resolution
 */

// Type definitions
export type { OrderItemWithRelations } from "./types.js"

// UUID Resolution
export {
	resolveProductByUuid,
	resolveOfferByUuid,
	resolveVariationItemsByUuids,
	resolveVariationsFromInput
} from "./resolvers.js"
