import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  Search,
  LogIn,
  LogOut,
  UserPlus,
  Shield,
  RefreshCcw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { useProps } from "@/App";

interface RawGroup {
  cid: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

interface GroupSummary {
  cid: string;
  name: string;
  description?: string;
  visibility: "public" | "private";
  type: "dm" | "custom" | "user_default";
  memberCount: number;
  updatedAt: string;
}

interface PublicGroup extends GroupSummary {
  joined: boolean;
}

interface UserSearchResult {
  id: number;
  user_name: string;
  user_profile: {
    displayName?: string;
  };
}

const AUTH_HEADER = (): string | null => {
  const stored = localStorage.getItem("auth");
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (typeof parsed === "string") {
      return parsed;
    }
    return stored;
  } catch {
    return stored;
  }
};

const mapRawGroup = (raw: RawGroup): GroupSummary => {
  const name =
    raw?.data?.group?.name ||
    raw?.data?.description?.content ||
    "Untitled Group";

  const memberCount = Array.isArray(raw?.data?.group?.userProfiles)
    ? raw.data.group.userProfiles.length
    : 0;

  return {
    cid: raw.cid,
    name,
    description:
      typeof raw?.data?.description?.content === "string"
        ? raw.data.description.content
        : undefined,
    visibility: raw?.data?.group?.visibility === "public" ? "public" : "private",
    type:
      raw?.data?.group?.type === "dm"
        ? "dm"
        : raw?.data?.group?.type === "user_default"
        ? "user_default"
        : "custom",
    memberCount,
    updatedAt: raw.updatedAt,
  };
};

const memberLabel = (group: GroupSummary) => {
  if (group.type === "dm") {
    return "Direct message";
  }
  return `${group.memberCount} member${group.memberCount === 1 ? "" : "s"}`;
};

export const GroupDirectory: React.FC = () => {
  const { data } = useProps();
  const apiUrl = data.apiUrl || window.Fos.apiUrl;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [myGroups, setMyGroups] = useState<GroupSummary[]>([]);
  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState<boolean>(false);
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [newGroupDescription, setNewGroupDescription] = useState<string>("");
  const [newGroupPublic, setNewGroupPublic] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const authToken = AUTH_HEADER();
    if (!authToken) {
      setError("You must be authenticated to manage groups.");
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [myGroupResponse, publicGroupResponse] = await Promise.all([
          fetch(`${apiUrl}/groups`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch(`${apiUrl}/groups/public?limit=50`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
        ]);

        if (!myGroupResponse.ok) {
          throw new Error("Failed to load your groups");
        }
        if (!publicGroupResponse.ok) {
          throw new Error("Failed to load public groups");
        }

        const myGroupJson = await myGroupResponse.json();
        const publicGroupJson = await publicGroupResponse.json();

        if (!isMounted) return;

        const myGroupSummaries: GroupSummary[] = Array.isArray(myGroupJson?.groups)
          ? myGroupJson.groups.map(mapRawGroup)
          : [];
        setMyGroups(myGroupSummaries);

        const myGroupIds = new Set(myGroupSummaries.map((group) => group.cid));
        const publicSummaries: PublicGroup[] = Array.isArray(publicGroupJson?.groups)
          ? publicGroupJson.groups.map((group: RawGroup) => {
              const summary = mapRawGroup(group);
              return {
                ...summary,
                joined: myGroupIds.has(summary.cid),
              };
            })
          : [];
        setPublicGroups(publicSummaries);
      } catch (loadError) {
        console.error(loadError);
        if (isMounted) {
          setError("Unable to load group information. Please try again.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [apiUrl]);

  const handleRefresh = async () => {
    const authToken = AUTH_HEADER();
    if (!authToken) {
      setError("You must be authenticated to manage groups.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const myGroupResponse = await fetch(`${apiUrl}/groups`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const publicGroupResponse = await fetch(`${apiUrl}/groups/public?limit=50`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!myGroupResponse.ok) throw new Error("Failed to load your groups");
      if (!publicGroupResponse.ok) throw new Error("Failed to load public groups");

      const myGroupJson = await myGroupResponse.json();
      const publicGroupJson = await publicGroupResponse.json();

      const myGroupSummaries: GroupSummary[] = Array.isArray(myGroupJson?.groups)
        ? myGroupJson.groups.map(mapRawGroup)
        : [];
      setMyGroups(myGroupSummaries);

      const myGroupIds = new Set(myGroupSummaries.map((group) => group.cid));
      const publicSummaries: PublicGroup[] = Array.isArray(publicGroupJson?.groups)
        ? publicGroupJson.groups.map((group: RawGroup) => {
            const summary = mapRawGroup(group);
            return { ...summary, joined: myGroupIds.has(summary.cid) };
          })
        : [];
      setPublicGroups(publicSummaries);
    } catch (refreshError) {
      console.error(refreshError);
      setError("Unable to refresh groups right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenGroup = (group: GroupSummary) => {
    navigate(`/inbox?group=${encodeURIComponent(group.cid)}`);
    toast({
      title: "Opening conversation",
      description: `Filtering inbox to ${group.name}`,
    });
  };

  const filteredMyGroups = useMemo(() => {
    if (!searchTerm.trim()) return myGroups;
    return myGroups.filter((group) =>
      group.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );
  }, [myGroups, searchTerm]);

  const filteredPublicGroups = useMemo(() => {
    if (!searchTerm.trim()) return publicGroups;
    return publicGroups.filter((group) =>
      group.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );
  }, [publicGroups, searchTerm]);

  const handleSearchUsers = async (value: string) => {
    setUserSearch(value);
    if (!value.trim()) {
      setUserResults([]);
      return;
    }
    const authToken = AUTH_HEADER();
    if (!authToken) return;

    setIsSearchingUsers(true);
    try {
      const response = await fetch(
        `${apiUrl}/groups/search/name?name=${encodeURIComponent(value)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      if (!response.ok) throw new Error("Failed to search users");
      const json = await response.json();
      setUserResults(Array.isArray(json?.users) ? json.users : []);
    } catch (searchError) {
      console.error(searchError);
      setUserResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleCreateDM = async (targetUserId: number) => {
    const authToken = AUTH_HEADER();
    if (!authToken) {
      toast({
        title: "Not signed in",
        description: "Please sign in to start a direct message.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/groups/dm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ targetUserId }),
      });
      if (!response.ok) throw new Error("Failed to create DM");
      toast({
        title: "Direct message ready",
        description: "Opening the conversation in your inbox.",
      });
      await handleRefresh();
      navigate('/inbox');
    } catch (dmError) {
      console.error(dmError);
      toast({
        title: "Could not start DM",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinGroup = async (group: PublicGroup) => {
    const authToken = AUTH_HEADER();
    if (!authToken) {
      toast({
        title: "Authentication required",
        description: "Sign in to join public groups.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/groups/${group.cid}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) throw new Error("Failed to join group");
      toast({
        title: "Joined group",
        description: `You are now a member of ${group.name}`,
      });
      await handleRefresh();
    } catch (joinError) {
      console.error(joinError);
      toast({
        title: "Join failed",
        description: "We were unable to add you to the group.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast({
        title: "Group name required",
        description: "Please provide a name for your new group.",
        variant: "destructive",
      });
      return;
    }

    const authToken = AUTH_HEADER();
    if (!authToken) {
      toast({
        title: "Authentication required",
        description: "Please sign in to create groups.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || undefined,
          visibility: newGroupPublic ? "public" : "private",
        }),
      });

      if (!response.ok) throw new Error("Failed to create group");

      toast({
        title: "Group created",
        description: "Your new group is ready. Opening it in the inbox.",
      });
      setCreateDialogOpen(false);
      setNewGroupName("");
      setNewGroupDescription("");
      setNewGroupPublic(false);
      await handleRefresh();
    } catch (createError) {
      console.error(createError);
      toast({
        title: "Could not create group",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Groups & Direct Messages</h1>
              <p className="text-sm text-muted-foreground">
                Manage your conversations and discover public groups to join.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search groups"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-64"
            />
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a new group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group name</Label>
                    <Input
                      id="group-name"
                      placeholder="Enter a group name"
                      value={newGroupName}
                      onChange={(event) => setNewGroupName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-description">Description</Label>
                    <Textarea
                      id="group-description"
                      placeholder="Optional description"
                      value={newGroupDescription}
                      onChange={(event) =>
                        setNewGroupDescription(event.target.value)
                      }
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label htmlFor="group-visibility">Public group</Label>
                      <p className="text-xs text-muted-foreground">
                        Public groups are discoverable by everyone.
                      </p>
                    </div>
                    <Switch
                      id="group-visibility"
                      checked={newGroupPublic}
                      onCheckedChange={setNewGroupPublic}
                    />
                  </div>
                  <Button onClick={handleCreateGroup} disabled={isSubmitting}>
                    {isSubmitting ? "Creating…" : "Create group"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>My conversations</CardTitle>
              <CardDescription>
                Direct messages and groups you are part of.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading your groups…</p>
              ) : filteredMyGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center">
                  <LogIn className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    You’re not in any conversations yet. Join a public group or start a DM.
                  </p>
                  <Button className="mt-3" onClick={() => navigate("/inbox")}>
                    Go to inbox
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[420px] pr-4">
                  <div className="space-y-3">
                    {filteredMyGroups.map((group) => (
                      <Card key={group.cid}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{group.name}</CardTitle>
                            <Badge variant="outline">
                              {group.type === "dm" ? "Direct message" : "Group"}
                            </Badge>
                          </div>
                          {group.description && (
                            <CardDescription>{group.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">
                            {memberLabel(group)}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => handleOpenGroup(group)}>
                              <LogIn className="h-4 w-4 mr-2" />
                              Open in inbox
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Public groups</CardTitle>
              <CardDescription>
                Discover communities you can join instantly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading public groups…</p>
              ) : filteredPublicGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center">
                  <Shield className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No public groups found. Try a different search term.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[420px] pr-4">
                  <div className="space-y-3">
                    {filteredPublicGroups.map((group) => (
                      <Card key={group.cid}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{group.name}</CardTitle>
                            <Badge variant={group.joined ? "secondary" : "outline"}>
                              {group.joined ? "Joined" : "Public"}
                            </Badge>
                          </div>
                          {group.description && (
                            <CardDescription>{group.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">
                            {memberLabel(group)}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() => handleOpenGroup(group)}
                            >
                              <LogIn className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            <Button
                              onClick={() => handleJoinGroup(group)}
                              disabled={group.joined || isSubmitting}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              {group.joined ? "Joined" : "Join"}
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Start a direct message</CardTitle>
              <CardDescription>
                Search for colleagues or partners and start chatting instantly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search users by name"
                  value={userSearch}
                  onChange={(event) => handleSearchUsers(event.target.value)}
                />
                <Button variant="outline" disabled>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              {isSearchingUsers ? (
                <p className="text-sm text-muted-foreground">Searching…</p>
              ) : userResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Search to find people and start a conversation.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {userResults.map((user) => (
                    <Card key={user.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          {user.user_profile?.displayName || user.user_name}
                        </CardTitle>
                        <CardDescription>{user.user_name}</CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => handleCreateDM(user.id)}
                          disabled={isSubmitting}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Start DM
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GroupDirectory;
