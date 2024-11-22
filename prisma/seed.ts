

import { PrismaClient } from '@prisma/client'
import { attachUserToGroup, createGroup, createUser, createUserWithNodes } from './seedHelpers'
import { generateSeedContext } from './seedData'

import { v4 as uuidv4 } from 'uuid';
import { FosDataContent } from '@/shared/types';


const prisma = new PrismaClient()





async function main() {










  const dn0 = await createUserWithNodes(prisma, { user_name: 'dmn322@fosforescent.com' }, generateSeedContext())
  const dn1 = await createUserWithNodes(prisma, { user_name: 'dmn322+1@fosforescent.com' }, generateSeedContext())
  const dn2 = await createUserWithNodes(prisma, { user_name: 'dmn322+2@fosforescent.com' }, generateSeedContext())
  const dn3 = await createUserWithNodes(prisma, { user_name: 'dmn322+3@fosforescent.com' }, generateSeedContext())
  const dn4 = await createUserWithNodes(prisma, { user_name: 'dmn322+4@fosforescent.com' }, generateSeedContext())
  const dn5 = await createUserWithNodes(prisma, { user_name: 'dmn322+5@fosforescent.com' }, generateSeedContext())


  console.log({ dn0, dn1, dn2, dn3, dn4, dn5 })

  const publicGroupData: FosDataContent = {
    group: {
      id: "0",
      name: "Everyone",
      userProfiles: []
    } 
  }

  const group0 = await createGroup(prisma, uuidv4(), { groupId: 0, rootNodeData: publicGroupData, description: 'Everyone Group' })
  const group1 = await createGroup(prisma, uuidv4(), { groupId: 1 })  
  const group2 = await createGroup(prisma, uuidv4(), { groupId: 2 })

  attachUserToGroup(prisma, dn0, group0)
  attachUserToGroup(prisma, dn0, group2)
  attachUserToGroup(prisma, dn1, group0)
  attachUserToGroup(prisma, dn2, group0)
  attachUserToGroup(prisma, dn3, group0)
  attachUserToGroup(prisma, dn4, group0)
  attachUserToGroup(prisma, dn4, group1)
  attachUserToGroup(prisma, dn5, group0)
  attachUserToGroup(prisma, dn5, group1)
  attachUserToGroup(prisma, dn5, group2)

  console.log({ group0, group1, group2 })

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