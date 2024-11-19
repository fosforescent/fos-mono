import httpMocks from 'node-mocks-http';
import jwt from 'jsonwebtoken';
import { postUserDataPartial } from '.';
import { PrismaClient, User } from '@prisma/client';
import { verifyJWTMiddleware } from '../verifyJwt';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended'

process.env.JWT_SECRET = "mytestsecret"

const fakeUserData: User = {
  user_name: 'hello@test.com',
  approved: true,
  id: 3,
  data: {
    test: 'test'
  },
  api_calls_available: 100,
  api_calls_used: 0,
  api_calls_total: 100,
  subscription_status: 'active',
  password: 'password',
  user_profile: {

  },
  createdAt: new Date(),
  updatedAt: new Date(),
  fosGroupId: 1,
  subscription_checkout_session_id: 'test',
  portal_session_id: 'test',
  stripe_customer_id: 'test',
  email_confirmation_expiration: new Date(),
  email_confirmation_token: 'test',
  password_reset_expiration: new Date(),
  password_reset_token: 'test',
  accepted_terms: new Date(),
  cookies: true,
}



beforeEach(() => {
  
});


describe.skip('merge Data', () => {

  function MockPrismaClient() { 
    const prismaClientMock = mockDeep<PrismaClient>();
    prismaClientMock.user.findUnique
      .mockResolvedValueOnce(fakeUserData)
      .mockResolvedValueOnce(fakeUserData)
      .mockResolvedValueOnce(fakeUserData)
      .mockResolvedValueOnce(fakeUserData)
      .mockResolvedValue(fakeUserData);
  
  
  
    return prismaClientMock
  };
  
  
  jest.mock('@prisma/client', () => ({
    __esModule: true,
    default: MockPrismaClient,
    PrismaClient: MockPrismaClient,
  }));


  it('runs test', async () => {
    process.env.JWT_SECRET = "mytestsecret"
    const prisma = new PrismaClient()

    console.log('prisma', prisma);


    const claims = {
      username: "hello@test.com",
      exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) // 8 hours from now
    }

    const token = jwt.sign(claims, process.env.JWT_SECRET)

    const req = httpMocks.createRequest({
      method: 'POST',
      url: '/user/data',
      body: {
        data: {
          test: 'test'
        },
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const res = httpMocks.createResponse();

    // await verifyJWTMiddleware(req, res, () => { });

    // await postUserDataPartial(req, res);

    expect(res._getData()).toBe('Internal Server Error');
  });

});