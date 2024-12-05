

import { PrismaClient } from '@prisma/client'

import { generateSeedContext } from './seedData'

import { v4 as uuidv4 } from 'uuid';
import { FosDataContent } from '@/shared/types';
import { createSeedUser } from '@/backend/util';


const prisma = new PrismaClient()





async function main() {










  const us0 = await createSeedUser(prisma, generateSeedContext(), { username: 'dmn322@fosforescent.com' })
  const us1 = await createSeedUser(prisma, generateSeedContext(), { username: 'dmn322+1@fosforescent.com' })
  const us2 = await createSeedUser(prisma, generateSeedContext(), { username: 'dmn322+2@fosforescent.com' })
  const us3 = await createSeedUser(prisma, generateSeedContext(), { username: 'dmn322+3@fosforescent.com' })
  const us4 = await createSeedUser(prisma, generateSeedContext(), { username: 'dmn322+4@fosforescent.com' })
  const us5 = await createSeedUser(prisma, generateSeedContext(), { username: 'dmn322+5@fosforescent.com' })


  const us0Root = us0.getRootExpression()

  const newGroup = us0Root.addGroup("My first cool group")


  const publicGroupData: FosDataContent = {
    group: {
      id: "0",
      name: "Everyone",
      userProfiles: []
    } 
  }






  
}
main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })