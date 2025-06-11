import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

// Re-export PrismaClient type for backend usage
export { PrismaClient } from '@prisma/client'

export default prisma