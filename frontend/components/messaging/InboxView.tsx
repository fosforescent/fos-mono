import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Inbox, Users, Shield, MessageSquare, RefreshCcw, Send } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useProps } from "@/App";

type GroupVisibility = "public" | "private";
type GroupKind = "user_default" | "dm" | "custom";

interface GroupSummary {
  cid: string;
  name: string;
  description?: string;
  visibility: GroupVisibility;
  type: GroupKind;
  memberCount: number;
  updatedAt: string;
}

interface RawGroup {
  cid: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

interface InboxMessage {
  id: string;
  groupCid: string;
  groupName: string;
  groupType: GroupKind;
  content: string;
  author: string;
  createdAt: string;
}

interface MessagesByGroup {
  [groupCid: string]: InboxMessage[];
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

const getGroupName = (raw: RawGroup): string => {
  const potentialName =
    raw?.data?.group?.name ??
    raw?.data?.description?.content ??
    raw?.data?.title?.content;
  if (typeof potentialName === "string" && potentialName.trim().length > 0) {
    return potentialName.trim();
  }
  return "Untitled Group";
};

const getGroupType = (raw: RawGroup): GroupKind => {
  const kind = raw?.data?.group?.type;
  if (kind === "dm" || kind === "custom" || kind === "user_default") {
    return kind;
  }
  return "custom";
};

const getGroupVisibility = (raw: RawGroup): GroupVisibility => {
  const visibility = raw?.data?.group?.visibility;
  return visibility === "public" ? "public" : "private";
};

const buildGroupSummary = (raw: RawGroup): GroupSummary => ({
  cid: raw.cid,
  name: getGroupName(raw),
  description:
    typeof raw?.data?.description?.content === "string"
      ? raw.data.description.content
      : undefined,
  visibility: getGroupVisibility(raw),
  type: getGroupType(raw),
  memberCount: Array.isArray(raw?.data?.group?.userProfiles)
    ? raw.data.group.userProfiles.length
    : 0,
  updatedAt: raw.updatedAt,
});

const parseMessage = (
  raw: any,
  group: GroupSummary
): InboxMessage | null => {
  const content =
    typeof raw?.content === "string"
      ? raw.content
      : raw?.data?.message || "";

  if (!content) {
    return null;
  }

  const createdAtValue = raw?.createdAt ?? raw?.timestamp ?? Date.now();

  return {
    id: raw?.cid || `${group.cid}-${createdAtValue}`,
    groupCid: group.cid,
    groupName: group.name,
    groupType: group.type,
    content,
    author: raw?.authorName || raw?.author || "Unknown",
    createdAt:
      typeof createdAtValue === "number"
        ? new Date(createdAtValue).toISOString()
        : new Date(createdAtValue).toISOString(),
  };
};

export const InboxView: React.FC = () => {
  const { data } = useProps();
  const apiUrl = data.apiUrl || window.Fos.apiUrl;
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [messagesByGroup, setMessagesByGroup] = useState<MessagesByGroup>({});
  const [selectedGroupCid, setSelectedGroupCid] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [messageDraft, setMessageDraft] = useState<string>("");
  const [filterText, setFilterText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const groupParam = params.get("group");
    if (groupParam) {
      setSelectedGroupCid(groupParam);
    }
  }, [location.search]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      const authToken = AUTH_HEADER();
      if (!authToken) {
        setError("Authentication required to load messages.");
        setIsLoading(false);
        return;
      }

      try {
        const groupResponse = await fetch(`${apiUrl}/groups`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!groupResponse.ok) {
          throw new Error("Failed to load groups");
        }

        const groupJson = await groupResponse.json();
        const rawGroups: RawGroup[] = Array.isArray(groupJson?.groups)
          ? groupJson.groups
          : [];

        const summaries = rawGroups.map(buildGroupSummary);
        if (!isMounted) return;
        setGroups(summaries);

        const messageEntries: [string, InboxMessage[]][] = [];
        for (const group of summaries) {
          try {
            const response = await fetch(
              `${apiUrl}/groups/${group.cid}/messages?limit=50`,
              {
                headers: {
                  Authorization: `Bearer ${authToken}`,
                },
              }
            );

            if (!response.ok) {
              continue;
            }

            const messageJson = await response.json();
            const rawMessages: any[] = Array.isArray(messageJson?.messages)
              ? messageJson.messages
              : [];

            const parsedMessages = rawMessages
              .map((msg) => parseMessage(msg, group))
              .filter((msg): msg is InboxMessage => Boolean(msg));

            messageEntries.push([group.cid, parsedMessages]);
          } catch (innerError) {
            console.error("Failed to load messages for group", group.cid, innerError);
          }
        }

        if (!isMounted) return;
        setMessagesByGroup(Object.fromEntries(messageEntries));
      } catch (loadError) {
        console.error(loadError);
        if (!isMounted) return;
        setError("Failed to load conversations. Please try again.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [apiUrl]);

  const allMessages = useMemo(() => {
    const sourceGroups =
      selectedGroupCid === "all"
        ? groups
        : groups.filter((group) => group.cid === selectedGroupCid);

    const collected = sourceGroups.flatMap((group) => {
      const groupMessages = messagesByGroup[group.cid] || [];
      return groupMessages;
    });

    const filteredBySearch = filterText.trim()
      ? collected.filter(
          (message) =>
            message.content
              .toLowerCase()
              .includes(filterText.trim().toLowerCase()) ||
            message.author
              .toLowerCase()
              .includes(filterText.trim().toLowerCase()) ||
            message.groupName
              .toLowerCase()
              .includes(filterText.trim().toLowerCase())
        )
      : collected;

    return filteredBySearch.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [groups, messagesByGroup, selectedGroupCid, filterText]);

  const selectedGroup = useMemo(() => {
    if (selectedGroupCid === "all") return null;
    return groups.find((group) => group.cid === selectedGroupCid) || null;
  }, [groups, selectedGroupCid]);

  const handleSelectGroup = (groupCid: string) => {
    setSelectedGroupCid(groupCid);
    const params = new URLSearchParams(location.search);
    if (groupCid === "all") {
      params.delete("group");
    } else {
      params.set("group", groupCid);
    }
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const handleRefresh = async () => {
    const params = new URLSearchParams(location.search);
    const existingGroup = params.get("group");
    setSelectedGroupCid(existingGroup || "all");
    setFilterText("");
    setMessageDraft("");
    setIsLoading(true);
    setError(null);

    const authToken = AUTH_HEADER();
    if (!authToken) {
      setError("Authentication required to refresh conversations.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/groups`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to load groups");
      }
      const groupJson = await response.json();
      const rawGroups: RawGroup[] = Array.isArray(groupJson?.groups)
        ? groupJson.groups
        : [];
      const summaries = rawGroups.map(buildGroupSummary);
      setGroups(summaries);

      const refreshedEntries: [string, InboxMessage[]][] = [];
      for (const group of summaries) {
        try {
          const res = await fetch(
            `${apiUrl}/groups/${group.cid}/messages?limit=50`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            }
          );
          if (!res.ok) continue;
          const messageJson = await res.json();
          const rawMessages: any[] = Array.isArray(messageJson?.messages)
            ? messageJson.messages
            : [];
          const parsed = rawMessages
            .map((msg) => parseMessage(msg, group))
            .filter((msg): msg is InboxMessage => Boolean(msg));
          refreshedEntries.push([group.cid, parsed]);
        } catch (err) {
          console.error("Failed to refresh group messages", group.cid, err);
        }
      }
      setMessagesByGroup(Object.fromEntries(refreshedEntries));
    } catch (refreshError) {
      console.error(refreshError);
      setError("Unable to refresh conversations at this time.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedGroup || !messageDraft.trim()) {
      return;
    }

    const authToken = AUTH_HEADER();
    if (!authToken) {
      toast({
        title: "Authentication required",
        description: "Please sign in again to send messages.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(
        `${apiUrl}/groups/${selectedGroup.cid}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ message: messageDraft.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      setMessageDraft("");

      const reloadResponse = await fetch(
        `${apiUrl}/groups/${selectedGroup.cid}/messages?limit=50`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (reloadResponse.ok) {
        const messageJson = await reloadResponse.json();
        const rawMessages: any[] = Array.isArray(messageJson?.messages)
          ? messageJson.messages
          : [];
        const parsed = rawMessages
          .map((msg) => parseMessage(msg, selectedGroup))
          .filter((msg): msg is InboxMessage => Boolean(msg));

        setMessagesByGroup((prev) => ({
          ...prev,
          [selectedGroup.cid]: parsed,
        }));
      }
    } catch (sendError) {
      console.error(sendError);
      toast({
        title: "Failed to send message",
        description: "We could not deliver your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="border-b">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Inbox className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Inbox</h1>
              <p className="text-sm text-muted-foreground">
                All conversations across your groups and direct messages
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search messages or groups"
              className="w-64"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
            />
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
              data-testid="inbox-refresh"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">
              Conversations
            </h2>
            <div className="space-y-2">
              <Button
                variant={selectedGroupCid === "all" ? "default" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => handleSelectGroup("all")}
              >
                <MessageSquare className="h-4 w-4" />
                All messages
                <Badge variant="secondary" className="ml-auto">
                  {Object.values(messagesByGroup).reduce(
                    (acc, messages) => acc + messages.length,
                    0
                  )}
                </Badge>
              </Button>
              <ScrollArea className="h-[calc(100vh-220px)] pr-2">
                <div className="space-y-2">
                  {groups.map((group) => {
                    const unreadCount = messagesByGroup[group.cid]?.length ?? 0;
                    const isActive = selectedGroupCid === group.cid;
                    return (
                      <Button
                        key={group.cid}
                        variant={isActive ? "default" : "ghost"}
                        className="w-full justify-start gap-2"
                        onClick={() => handleSelectGroup(group.cid)}
                      >
                        <span className="truncate">{group.name}</span>
                        <span className="ml-auto flex items-center gap-2">
                          {group.type === "dm" ? (
                            <Users className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Shield className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Badge variant="outline">{unreadCount}</Badge>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          {error && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-4">
              {isLoading ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Loading conversations…</CardTitle>
                    <CardDescription>
                      Fetching the latest messages across your groups.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      This may take a few seconds the first time.
                    </p>
                  </CardContent>
                </Card>
              ) : allMessages.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No messages yet</CardTitle>
                    <CardDescription>
                      Start a conversation by selecting a group or sending a direct
                      message.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => navigate("/groups")}>
                      Browse groups
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                allMessages.map((message) => (
                  <Card
                    key={message.id}
                    className="hover:border-primary cursor-pointer transition"
                    onClick={() => handleSelectGroup(message.groupCid)}
                  >
                    <CardHeader className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">
                            {message.groupName}
                          </CardTitle>
                          <Badge variant="outline">
                            {message.groupType === "dm" ? "Direct" : "Group"}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <CardDescription className="text-sm flex items-center gap-2">
                        <strong>{message.author}</strong>
                        <span className="text-muted-foreground">said</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-6 whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="border-t bg-muted/40 p-4">
            <div className="max-w-4xl mx-auto space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedGroup
                    ? `Replying to ${selectedGroup.name}`
                    : "Select a group to send a message"}
                </span>
                {selectedGroup && (
                  <Badge variant="secondary">
                    {selectedGroup.type === "dm" ? "Direct message" : "Group chat"}
                  </Badge>
                )}
              </div>
              <div className="flex items-start gap-3">
                <Textarea
                  placeholder={
                    selectedGroup
                      ? `Send a message to ${selectedGroup.name}`
                      : "Choose a conversation to reply"
                  }
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  disabled={!selectedGroup || isSending}
                  rows={3}
                />
                <Button
                  className="self-stretch"
                  onClick={handleSendMessage}
                  disabled={!selectedGroup || !messageDraft.trim() || isSending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default InboxView;
