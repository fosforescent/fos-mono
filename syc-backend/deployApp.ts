import { Request, Response } from 'express'

import k8s from '@kubernetes/client-node'

import { IncomingMessage } from 'http'

import {prisma} from './prismaClient'

interface CheckoutSessionCreateRequest {
  success_url: string;
  cancel_url: string;
}

/***
 * This is not used and should not be used... keeping around for kubernetes etc. API reference.
 */

export const githubDeploymentWebhook = async (req: Request, res: Response) => {
  const app_token = req.headers['syc-token']!

  const devRegex = /dev\./

  const hostMatches = req.hostname.match(devRegex)

  const hostType = hostMatches ? 'dev' : 'prod'

  if (app_token !== process.env.SYC_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const app = await prisma.app.findFirst({
    where: {
      repo_url: req.body.repository.full_name,
      token: app_token
    }
  })

  if (!app) {
    return res.status(404).json({ error: 'App not found' })
  }

  const valuesFile = `values-${hostType}.yaml`

  console.log('App:', app, valuesFile)

  const appManifest = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: app.name,
      namespace: 'argocd'
    },
    spec: {
      project: 'fos-project',
      source: {
        repoURL: app.repo_url,
        path: './helm',
        targetRevision: 'HEAD',
        helm: {
          valueFiles: [valuesFile]
        }
      },
      destination: {
        server: 'https://kubernetes.default.svc',
        namespace: 'fos'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        }
      }
    }
  }

  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()

  const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi)

  k8sApi.createNamespacedCustomObject(
    'argoproj.io',
    'v1alpha1',
    'argocd',
    'applications',
    appManifest
  ).then(
    (value: { response: IncomingMessage; body: object; }) => {
      console.log('Created Argo CD Application:', value)
    },
    (error: Error) => {
      console.error('Error creating Argo CD Application:', error)
    }
  )

  return res.status(200).json({ message: 'Success' })
}
