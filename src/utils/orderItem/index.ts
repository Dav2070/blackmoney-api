/**
 * OrderItem Utilities Module
 *
 * This module provides comprehensive utilities for handling OrderItems:
 * - UUID resolution (GraphQL UUIDs → Database IDs)
 * - OrderItem creation with all related data
 * - OrderItem comparison logic for intelligent merging
 * - OrderItem merging operations
 *
 * Module Structure:
 * - types.ts: Shared TypeScript type definitions
 * - resolvers.ts: UUID to database ID resolution
 * - creation.ts: Creating new OrderItems
 * - comparison.ts: Comparing OrderItems for merge compatibility
 * - merging.ts: Merging operations for OrderItems
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

// OrderItem Creation
export { createOrderItemForProductInput } from "./creation.js"

// OrderItem Comparison
export {
	isOrderItemMetaEqual,
	productInputAndOrderItemEqual
} from "./comparison.js"

// OrderItem Merging
export {
	mergeOrAddVariations,
	mergeProductIntoOrderItem,
	resolveAndMergeChildVariations
} from "./merging.js"
