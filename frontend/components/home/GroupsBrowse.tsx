import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Users,
  MessageSquare,
  Globe,
  Lock,
  Plus,
  Search,
  UserPlus,
  Crown,
  ArrowLeft
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { GroupConsole } from '@/components/console/GroupConsole'

interface Group {
  cid: string
  data: {
    group?: {
      id: string
      name: string
      type: 'user_default' | 'dm' | 'custom'
      visibility?: 'public' | 'private'
      userProfiles?: string[]
      createdBy?: string
    }
    description?: {
      content: string
    }
  }
  createdAt: Date
  updatedAt: Date
}

interface User {
  id: number
  user_name: string
  user_profile: any
  fosNodeId: string
}

interface GroupsBrowseProps {
  apiUrl: string
}

export const GroupsBrowse: React.FC<GroupsBrowseProps> = ({ apiUrl }) => {
  const [myGroups, setMyGroups] = useState<Group[]>([])
  const [publicGroups, setPublicGroups] = useState<Group[]>([])
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

  // New group form
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [newGroupVisibility, setNewGroupVisibility] = useState<'public' | 'private'>('private')

  const { toast } = useToast()

  // If a group is selected, show the console
  if (selectedGroup) {
    const members = selectedGroup.data.group?.userProfiles?.map(cid => ({
      cid,
      name: 'Member', // TODO: Get actual names
      isOnline: false
    })) || []

    return (
      <div className="container mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => setSelectedGroup(null)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Groups
        </Button>
        <GroupConsole
          groupCid={selectedGroup.cid}
          groupName={selectedGroup.data.group?.name || 'Untitled Group'}
          members={members}
          apiUrl={apiUrl || window.Fos.apiUrl}
        />
      </div>
    )
  }

  useEffect(() => {
    loadMyGroups()
    loadPublicGroups()
  }, [])

  const loadMyGroups = async () => {
    try {
      const response = await fetch(`${apiUrl}/groups`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setMyGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    }
  }

  const loadPublicGroups = async () => {
    try {
      const response = await fetch(`${apiUrl}/groups/public?limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setPublicGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error loading public groups:', error)
    }
  }

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/groups/search/name?name=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.users || [])
      }
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createDM = async (targetUserId: number) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/groups/dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify({ targetUserId })
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: data.created ? "DM Created" : "DM Opened",
          description: `Chat with ${searchResults.find(u => u.id === targetUserId)?.user_name}`
        })
        loadMyGroups()
        setSearchQuery('')
        setSearchResults([])
      }
    } catch (error) {
      console.error('Error creating DM:', error)
      toast({
        title: "Error",
        description: "Failed to create DM",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createGroup = async () => {
    if (!newGroupName.trim()) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${apiUrl}/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth')}`
        },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDescription,
          visibility: newGroupVisibility
        })
      })

      if (response.ok) {
        toast({
          title: "Group Created",
          description: `${newGroupName} has been created`
        })
        setIsCreateDialogOpen(false)
        setNewGroupName('')
        setNewGroupDescription('')
        setNewGroupVisibility('private')
        loadMyGroups()
        if (newGroupVisibility === 'public') {
          loadPublicGroups()
        }
      }
    } catch (error) {
      console.error('Error creating group:', error)
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getGroupIcon = (type?: string) => {
    switch (type) {
      case 'dm':
        return <MessageSquare className="h-4 w-4" />
      case 'user_default':
        return <Crown className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  const getGroupBadge = (group: Group) => {
    const visibility = group.data.group?.visibility
    const type = group.data.group?.type

    if (visibility === 'public') {
      return <Badge variant="outline" className="ml-2"><Globe className="h-3 w-3 mr-1" />Public</Badge>
    }
    if (type === 'dm') {
      return <Badge variant="outline" className="ml-2"><MessageSquare className="h-3 w-3 mr-1" />DM</Badge>
    }
    return <Badge variant="outline" className="ml-2"><Lock className="h-3 w-3 mr-1" />Private</Badge>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Groups & Chats</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
              <DialogDescription>
                Create a collaborative workspace or chat room
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="groupName">Group Name</Label>
                <Input
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="My Team"
                />
              </div>
              <div>
                <Label htmlFor="groupDescription">Description</Label>
                <Textarea
                  id="groupDescription"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="What's this group about?"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="visibility">Public Group</Label>
                <Switch
                  id="visibility"
                  checked={newGroupVisibility === 'public'}
                  onCheckedChange={(checked) => setNewGroupVisibility(checked ? 'public' : 'private')}
                />
              </div>
              <Button onClick={createGroup} disabled={isLoading} className="w-full">
                Create Group
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="my-groups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="my-groups">My Groups</TabsTrigger>
          <TabsTrigger value="public">Public Groups</TabsTrigger>
          <TabsTrigger value="start-dm">Start DM</TabsTrigger>
        </TabsList>

        <TabsContent value="my-groups" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {myGroups.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No groups yet. Create one or start a DM!</p>
                  </CardContent>
                </Card>
              ) : (
                myGroups.map((group) => (
                  <Card
                    key={group.cid}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setSelectedGroup(group)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        {getGroupIcon(group.data.group?.type)}
                        <span className="ml-2">{group.data.group?.name || 'Untitled Group'}</span>
                        {getGroupBadge(group)}
                      </CardTitle>
                      {group.data.description && (
                        <CardDescription>{group.data.description.content}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="h-4 w-4 mr-1" />
                        {group.data.group?.userProfiles?.length || 0} members
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="public" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {publicGroups.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No public groups available</p>
                  </CardContent>
                </Card>
              ) : (
                publicGroups.map((group) => (
                  <Card
                    key={group.cid}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setSelectedGroup(group)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        {getGroupIcon(group.data.group?.type)}
                        <span className="ml-2">{group.data.group?.name || 'Untitled Group'}</span>
                        {getGroupBadge(group)}
                      </CardTitle>
                      {group.data.description && (
                        <CardDescription>{group.data.description.content}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Users className="h-4 w-4 mr-1" />
                          {group.data.group?.userProfiles?.length || 0} members
                        </div>
                        <Button size="sm" variant="outline">
                          <UserPlus className="h-4 w-4 mr-1" />
                          Join
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="start-dm" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                searchUsers(e.target.value)
              }}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[550px]">
            <div className="space-y-2">
              {isLoading ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p>Searching...</p>
                  </CardContent>
                </Card>
              ) : searchResults.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Search for users to start a conversation</p>
                  </CardContent>
                </Card>
              ) : (
                searchResults.map((user) => (
                  <Card key={user.id} className="hover:bg-accent transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{user.user_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.user_profile?.displayName || user.user_name}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => createDM(user.id)}
                          disabled={isLoading}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Message
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
