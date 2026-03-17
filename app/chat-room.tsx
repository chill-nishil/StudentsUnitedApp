import BLOCKED_WORDS from "@/blockedWords";
import { db } from "@/FirebaseConfig";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

type Message = {
  id: string;
  message: string;
  senderName: string;
  senderUid?: string;
  position: string;
  createdAt: any;
  reactions?: {
    [emoji: string]: string[];
  };
  mediaBase64?: string;
};

function isValidDate(d: any): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

function toDateSafe(createdAt: any): Date | null {
  if (!createdAt) return null;

  if (typeof createdAt?.toDate === "function") {
    const d = createdAt.toDate();
    return isValidDate(d) ? d : null;
  }

  if (createdAt instanceof Date) return isValidDate(createdAt) ? createdAt : null;

  if (typeof createdAt === "number") {
    const d = new Date(createdAt);
    return isValidDate(d) ? d : null;
  }

  if (typeof createdAt === "string") {
    const d = new Date(createdAt);
    return isValidDate(d) ? d : null;
  }

  return null;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayDiffFromToday(d: Date): number {
  const today = startOfDay(new Date()).getTime();
  const day = startOfDay(d).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((day - today) / msPerDay);
}

function formatDayHeader(d: Date): string {
  const diff = dayDiffFromToday(d);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function containsProfanity(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(" ").filter(Boolean);

  return words.some(word => BLOCKED_WORDS.includes(word));
}

function isMessageAfterCutoff(messageCreatedAt: any, cutoff: any): boolean {
  const messageDate =
    messageCreatedAt && typeof messageCreatedAt?.toDate === "function"
      ? messageCreatedAt.toDate()
      : messageCreatedAt instanceof Date
      ? messageCreatedAt
      : null;

  const cutoffDate =
    cutoff && typeof cutoff?.toDate === "function"
      ? cutoff.toDate()
      : cutoff instanceof Date
      ? cutoff
      : null;

  if (!messageDate || !cutoffDate) return false;

  return messageDate.getTime() > cutoffDate.getTime();
}

export default function ChatScreen() {
  const auth = getAuth();
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userName, setUserName] = useState("");
  const [position, setPosition] = useState("");
  const [clubName, setClubName] = useState("");
  const [userClubId, setUserClubId] = useState<string | null>(null);

  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiInput, setEmojiInput] = useState("");
  const emojiInputRef = useRef<TextInput>(null);
  const [expandedReactions, setExpandedReactions] = useState<Record<string, string[]>>({});
  const cancelEmojiReaction = () => {
    emojiInputRef.current?.blur();
    Keyboard.dismiss();
    setShowEmojiPicker(false);
    setActiveMessageId(null);
    setEmojiInput("");
  };

  const [isPresident, setIsPresident] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [requestUsers, setRequestUsers] = useState<any[]>([]);

  const [isPickingMedia, setIsPickingMedia] = useState(false);
  const [pendingMediaBase64, setPendingMediaBase64] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [chatBackgroundBase64, setChatBackgroundBase64] = useState<string | null>(null);
  const [isPickingBackground, setIsPickingBackground] = useState(false);

  const hasBackground = !!chatBackgroundBase64;

  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);
  const [pinnedPreview, setPinnedPreview] = useState<string | null>(null);
  const [pinnedSenderName, setPinnedSenderName] = useState<string | null>(null);
  const [pinnedCreatedAt, setPinnedCreatedAt] = useState<any>(null);

  const listRef = useRef<FlatList<Message>>(null);

  const params = useLocalSearchParams<{ clubId?: string; clubName?: string }>();
  const selectedClubId = typeof params.clubId === "string" ? params.clubId : null;
  const selectedClubName = typeof params.clubName === "string" ? params.clubName : null;

  const [unreadCutoff, setUnreadCutoff] = useState<any>(null);
  const [showUnreadHighlight, setShowUnreadHighlight] = useState(false);
  const unreadTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!currentUid || !userClubId) return;

    const userRef = doc(db, "users", currentUid);

    getDocs(query(collection(db, "users"), where("uid", "==", currentUid)))
      .then(async snap => {
        if (snap.empty) return;

        const data = snap.docs[0].data();
        const previousLastRead = data.lastReadByClub?.[userClubId] || null;

        setUnreadCutoff(previousLastRead);

        if (previousLastRead) {
          setShowUnreadHighlight(true);

          if (unreadTimerRef.current) {
            clearTimeout(unreadTimerRef.current);
          }

          unreadTimerRef.current = setTimeout(() => {
            setShowUnreadHighlight(false);
          }, 1000);
        } else {
          setShowUnreadHighlight(false);
        }

        await updateDoc(userRef, {
          [`lastReadByClub.${userClubId}`]: serverTimestamp()
        });
      })
      .catch((e: any) => {
        console.log("READ_UPDATE_ERROR", e?.code, e?.message, e);
      });

    return () => {
      if (unreadTimerRef.current) {
        clearTimeout(unreadTimerRef.current);
      }
    };
  }, [currentUid, userClubId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUid(user ? user.uid : null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      if (showEmojiPicker) {
        setShowEmojiPicker(false);
        setActiveMessageId(null);
        setEmojiInput("");
      }
    });

    return () => sub.remove();
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!currentUid) return;

    const userRef = doc(db, "users", currentUid);

    const unsub = onSnapshot(userRef, snap => {
      if (!snap.exists()) return;

      const data = snap.data();

      setUserName(data.name || "");

      const userClubIds = Array.isArray(data.clubIds) ? data.clubIds : [];
      const userClubNames = Array.isArray(data.clubNames) ? data.clubNames : [];
      const clubMemberships = Array.isArray(data.clubMemberships) ? data.clubMemberships : [];

      let resolvedClubId: string | null = null;
      let resolvedClubName = "Club Chat";

      if (selectedClubId) {
        resolvedClubId = selectedClubId;
        resolvedClubName = selectedClubName || "Club Chat";
      } else if (userClubIds.length > 0) {
        resolvedClubId = userClubIds[0];
        resolvedClubName = userClubNames[0] || "Club Chat";
      }

      if (!resolvedClubId) {
        router.replace(`/join-club?uid=${currentUid}`);
        return;
      }

      setUserClubId(resolvedClubId);
      setClubName(resolvedClubName);

      const matchingMembership = clubMemberships.find(
        (membership: any) => membership?.clubId === resolvedClubId
      );

      const resolvedPosition =
        matchingMembership?.position ||
        data.position ||
        "";

      setPosition(resolvedPosition);
    });

    return unsub;
  }, [currentUid, selectedClubId, selectedClubName]);

  useEffect(() => {
    if (!userClubId) return;
    const q = query(
      collection(db, "chats"),
      where("clubId", "==", userClubId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snapshot => {
      const list: Message[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          message: data.message,
          senderName: data.senderName,
          senderUid: data.senderUid,
          position: data.position,
          createdAt: data.createdAt,
          reactions: data.reactions || {},
          mediaBase64: data.mediaBase64
        };
      });
      setMessages(list);
    });

    return unsub;
  }, [userClubId]);

  useEffect(() => {
    if (!userClubId || !currentUid) return;

    const clubRef = doc(db, "clubs", userClubId);

    const unsub = onSnapshot(clubRef, async snap => {
      if (!snap.exists()) return;

      const data = snap.data();

      setIsPresident(data.presidentId === currentUid);
      setChatBackgroundBase64(data.chatBackgroundBase64 || null);
      setPinnedMessageId(data.pinnedMessageId || null);
      setPinnedPreview(data.pinnedPreview || null);
      setPinnedSenderName(data.pinnedSenderName || null);
      setPinnedCreatedAt(data.pinnedCreatedAt || null);

      const requests = Array.isArray(data.joinRequests) ? data.joinRequests : [];

      if (requests.length === 0) {
        setRequestUsers([]);
        return;
      }

      if (typeof requests[0] === "string") {
        const usersSnap = await getDocs(
          query(collection(db, "users"), where("uid", "in", requests))
        );

        setRequestUsers(
          usersSnap.docs.map(d => {
            const userData = d.data();
            return {
              uid: userData.uid,
              name: userData.name || "Unknown User",
              position: userData.position || ""
            };
          })
        );
        return;
      }

      setRequestUsers(
        requests.map((request: any) => ({
          uid: request.uid,
          name: request.name || "Unknown User",
          position: request.position || "",
          requestedAt: request.requestedAt || null,
          rawRequest: request
        }))
      );
    });

    return unsub;
  }, [userClubId, currentUid]);

  async function refreshClubLastMessage(clubId: string) {
    const latestQuery = query(
      collection(db, "chats"),
      where("clubId", "==", clubId),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const latestSnap = await getDocs(latestQuery);
    const clubRef = doc(db, "clubs", clubId);

    if (latestSnap.empty) {
      await updateDoc(clubRef, {
        lastMessage: "",
        lastMessageSender: "",
        lastMessageTime: null
      });
      return;
    }

    const latestData = latestSnap.docs[0].data();

    const latestText =
      latestData.message && latestData.message.trim()
        ? latestData.message.trim()
        : latestData.mediaBase64
        ? "Photo"
        : "";

    await updateDoc(clubRef, {
      lastMessage: latestText,
      lastMessageSender: latestData.senderName || "",
      lastMessageTime: latestData.createdAt || null
    });
  }

  async function acceptJoinRequest(requestItem: any) {
    if (!userClubId) return;
    if (!clubName) return;

    const requestUid =
      typeof requestItem === "string" ? requestItem : requestItem?.uid;
    const requestPosition =
      typeof requestItem === "string" ? "" : requestItem?.position || "";
    const requestToRemove =
      requestItem?.rawRequest ?? requestItem;

    if (!requestUid) return;

    const clubRef = doc(db, "clubs", userClubId);
    const userRef = doc(db, "users", requestUid);

    await updateDoc(clubRef, {
      members: arrayUnion(requestUid),
      joinRequests: arrayRemove(requestToRemove)
    });

    await updateDoc(userRef, {
      ...(requestPosition ? { position: requestPosition } : {}),
      clubIds: arrayUnion(userClubId),
      clubNames: arrayUnion(clubName),
      clubMemberships: arrayUnion({
        clubId: userClubId,
        position: requestPosition || "Member"
      }),
      pendingClubRequests: arrayRemove(userClubId)
    });
  }

  async function rejectJoinRequest(requestItem: any) {
    if (!userClubId) return;

    const requestUid =
      typeof requestItem === "string" ? requestItem : requestItem?.uid;
    const requestToRemove =
      requestItem?.rawRequest ?? requestItem;

    if (!requestUid) return;

    const clubRef = doc(db, "clubs", userClubId);
    const userRef = doc(db, "users", requestUid);

    await updateDoc(clubRef, {
      joinRequests: arrayRemove(requestToRemove)
    });

    await updateDoc(userRef, {
      pendingClubRequests: arrayRemove(userClubId)
    });
  }

  async function sendMessage() {
    if (!userName || !userClubId) return;
    if (isSending) return;

    const trimmed = input.trim();
    const hasText = !!trimmed;
    const hasMedia = !!pendingMediaBase64;

    if (!hasText && !hasMedia) return;

    if (hasText && containsProfanity(trimmed)) {
      Alert.alert(
        "Profanity Check",
        "Inappropriate language is not allowed!"
      );
      return;
    }

    const prevInput = input;
    const prevMedia = pendingMediaBase64;

    setIsSending(true);
    setInput("");
    setPendingMediaBase64(null);

    try {
      await addDoc(collection(db, "chats"), {
        message: hasText ? trimmed : "",
        senderName: userName,
        senderUid: currentUid,
        position: position,
        clubId: userClubId,
        createdAt: serverTimestamp(),
        reactions: {},
        ...(hasMedia ? { mediaBase64: prevMedia } : {})
      });

      const clubRef = doc(db, "clubs", userClubId);

      let previewText = "";
      if (hasText) {
        previewText = trimmed;
      } else if (hasMedia) {
        previewText = "Photo";
      }

      await updateDoc(clubRef, {
        lastMessage: previewText,
        lastMessageSender: userName,
        lastMessageTime: serverTimestamp()
      });

      const userRef = doc(db, "users", currentUid!);

      await updateDoc(userRef, {
        [`lastReadByClub.${userClubId}`]: serverTimestamp()
      });

      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (e: any) {
      console.log("SEND_ERROR", e?.code, e?.message, e);
      setInput(prevInput);
      setPendingMediaBase64(prevMedia);
    } finally {
      setIsSending(false);
    }
  }

  async function pickMedia() {
    if (isPickingMedia) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;

    setIsPickingMedia(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [9, 16],
        quality: 0.3
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const manipulated = await manipulateAsync(
        asset.uri,
        [{ resize: { width: 900 } }],
        { compress: 0.4, format: SaveFormat.JPEG, base64: true }
      );

      const base64 = manipulated.base64 || null;
      if (!base64) return;

      if (base64.length > 900000) {
        console.log("IMAGE_TOO_LARGE", base64.length);
        return;
      }

      setPendingMediaBase64(base64);
    } finally {
      setIsPickingMedia(false);
    }
  }

  async function pickChatBackground() {
    if (!isPresident) return;
    if (!userClubId) return;
    if (isPickingBackground) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;

    setIsPickingBackground(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [9, 16],
        quality: 0.3
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const manipulated = await manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.35, format: SaveFormat.JPEG, base64: true }
      );

      const base64 = manipulated.base64 || null;
      if (!base64) return;

      if (base64.length > 1100000) {
        console.log("BG_TOO_LARGE", base64.length);
        return;
      }

      const clubRef = doc(db, "clubs", userClubId);
      await updateDoc(clubRef, { chatBackgroundBase64: base64 });
    } finally {
      setIsPickingBackground(false);
    }
  }

  async function clearChatBackground() {
    if (!isPresident) return;
    if (!userClubId) return;

    Alert.alert("Remove background?", "This will reset the chat background for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const clubRef = doc(db, "clubs", userClubId);
            await updateDoc(clubRef, { chatBackgroundBase64: null });
          } catch (e: any) {
            console.log("CLEAR_BG_ERROR", e?.code, e?.message, e);
          }
        }
      }
    ]);
  }

  async function handleReaction(messageId: string, emoji: string) {
    const messageRef = doc(db, "chats", messageId);
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const updates: Record<string, any> = {};

    const reactions = message.reactions || {};

    Object.keys(reactions).forEach(existingEmoji => {
      const users = reactions[existingEmoji];
      if (users.includes(userName)) {
        updates[`reactions.${existingEmoji}`] = arrayRemove(userName);
      }
    });

    const currentUsers = reactions[emoji] || [];

    if (!currentUsers.includes(userName)) {
      updates[`reactions.${emoji}`] = arrayUnion(userName);
    }

    await updateDoc(messageRef, updates);

    setShowEmojiPicker(false);
    setActiveMessageId(null);
  }

  function confirmDeleteMessage(messageId: string, senderUid?: string) {
    if (!userClubId) return;
    if (!currentUid) return;

    const isOwnMessage = !!senderUid && senderUid === currentUid;
    const canDelete = isPresident || isOwnMessage;

    if (!canDelete) return;

    Alert.alert("Delete message?", "This will remove the message for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "chats", messageId));

            if (userClubId) {
              await refreshClubLastMessage(userClubId);
            }
          } catch (e: any) {
            console.log("DELETE_ERROR", e?.code, e?.message, e);
          }
        }
      }
    ]);
  }

  async function pinMessage(item: Message) {
    if (!userClubId) return;
    if (!isPresident) return;

    const clubRef = doc(db, "clubs", userClubId);

    const textPreview = (item.message || "").trim();
    const mediaOnlyPreview = item.mediaBase64 ? "Photo" : "";
    const preview = textPreview ? textPreview : mediaOnlyPreview;

    try {
      await updateDoc(clubRef, {
        pinnedMessageId: item.id,
        pinnedPreview: preview,
        pinnedSenderName: item.senderName,
        pinnedCreatedAt: item.createdAt
      });
    } catch (e: any) {
      console.log("PIN_ERROR", e?.code, e?.message, e);
    }
  }

  async function unpinMessage() {
    if (!userClubId) return;
    if (!isPresident) return;

    const clubRef = doc(db, "clubs", userClubId);

    try {
      await updateDoc(clubRef, {
        pinnedMessageId: null,
        pinnedPreview: null,
        pinnedSenderName: null
      });
    } catch (e: any) {
      console.log("UNPIN_ERROR", e?.code, e?.message, e);
    }
  }

  function scrollToPinned() {
    if (!pinnedMessageId) return;

    const idx = messages.findIndex(m => m.id === pinnedMessageId);
    if (idx < 0) return;

    try {
      listRef.current?.scrollToIndex({ index: idx, animated: true });
    } catch (e) {
    }
  }

  function handleMessageLongPress(item: Message, canDelete: boolean) {
    if (isPresident) {
      const isPinned = !!pinnedMessageId && pinnedMessageId === item.id;

      Alert.alert(
        "Chat Options",
        "",
        [
          {
            text: isPinned ? "Unpin" : "Pin",
            onPress: () => {
              if (isPinned) {
                unpinMessage();
              } else {
                pinMessage(item);
              }
            }
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => confirmDeleteMessage(item.id, item.senderUid)
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    confirmDeleteMessage(item.id, item.senderUid);
  }

  const EMOJI_REGEX = /^\p{Extended_Pictographic}$/u;

  const isSingleEmoji = (text: string): boolean => {
    return EMOJI_REGEX.test(text);
  };

  const formatTime = (createdAt: any): string => {
    try {
      const d =
        createdAt && typeof createdAt?.toDate === "function"
          ? createdAt.toDate()
          : createdAt instanceof Date
          ? createdAt
          : null;

      if (!d || isNaN(d.getTime())) return "";
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const ChatBody = (
    <View style={{ flex: 1 }}>
      {!!pinnedMessageId && (
        <Pressable style={styles.pinnedWrap} onPress={scrollToPinned}>
          <View style={styles.pinnedLeftBar} />

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text
                style={[
                  styles.pinnedTitle,
                  hasBackground && styles.darkOverlayText
                ]}
                numberOfLines={1}
              >
                Pinned message:
              </Text>

              {!!pinnedCreatedAt && (
                <Text
                  style={[
                    styles.pinnedTimeText,
                    hasBackground && styles.darkSubText
                  ]}
                >
                  {formatTime(pinnedCreatedAt)}
                </Text>
              )}
            </View>

            <Text
              style={[
                styles.pinnedText,
                hasBackground && styles.darkSubText
              ]}
              numberOfLines={1}
            >
              {(pinnedSenderName ? pinnedSenderName + ": " : "") + (pinnedPreview || "")}
            </Text>
          </View>
        </Pressable>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        inverted
        onScrollToIndexFailed={() => {
        }}
        renderItem={({ item, index }) => {
          const timeLabel = formatTime(item.createdAt);

          const curDate = toDateSafe(item.createdAt);
          const next = index < messages.length - 1 ? messages[index + 1] : null;
          const nextDate = next ? toDateSafe(next.createdAt) : null;
          const showDayHeader = !!curDate && (!nextDate || !sameDay(curDate, nextDate));

          const canDelete = isPresident || (!!currentUid && !!item.senderUid && item.senderUid === currentUid);
          const isPinnedRow = !!pinnedMessageId && pinnedMessageId === item.id;

          const shouldHighlightUnread =
            showUnreadHighlight &&
            item.senderUid !== currentUid &&
            isMessageAfterCutoff(item.createdAt, unreadCutoff);

          return (
            <View>
              {showDayHeader && (
                <View style={styles.dayHeaderWrap}>
                  <Text
                    style={[
                      styles.dayHeaderText,
                      hasBackground && styles.darkOverlayText
                    ]}
                  >
                    {formatDayHeader(curDate as Date)}
                  </Text>
                </View>
              )}
              <View style={[styles.messageGroup, item.senderName === userName ? styles.alignRight : styles.alignLeft]}>
                <Pressable
                  onLongPress={() => handleMessageLongPress(item, canDelete)}
                  disabled={!canDelete}
                >
                  <View style={[
                    styles.message,
                    item.senderName === userName ? styles.myMessage : styles.otherMessage,
                    isPinnedRow && styles.pinnedMessageOutline,
                    shouldHighlightUnread && styles.unreadMessageHighlight
                  ]}
                  >
                    <Text style={styles.sender}>
                      {item.senderName} · {item.position}
                    </Text>

                    {!!item.mediaBase64 && (
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${item.mediaBase64}` }}
                        style={styles.chatImage}
                      />
                    )}

                    {!!item.message && (
                      <Text style={item.senderName === userName ? styles.myMessageText : styles.otherMessageText}>
                        {item.message}
                      </Text>
                    )}
                  </View>
                </Pressable>

                <View style={styles.reactRow}>
                  <Pressable
                    style={styles.reactButton}
                    onPress={() => {
                      setActiveMessageId(item.id);
                      setShowEmojiPicker(true);
                      setTimeout(() => {
                        emojiInputRef.current?.focus();
                      }, 50);
                    }}
                  >
                    <Text
                      style={[
                        styles.reactText,
                        hasBackground && styles.darkSubText
                      ]}
                    >
                      {showEmojiPicker && activeMessageId === item.id
                        ? "Select an emoji from keyboard"
                        : "😊 React"}
                    </Text>
                  </Pressable>

                  {!!timeLabel && (
                    <Text
                      style={[
                        styles.reactTimeText,
                        hasBackground && styles.darkSubText
                      ]}
                    >
                      {timeLabel}
                    </Text>
                  )}
                </View>

                {item.reactions &&
                  Object.entries(item.reactions)
                    .filter(([_, users]) => users.length > 0)
                    .map(([emoji, users]) => {
                      const expandedForMessage = expandedReactions[item.id] || [];
                      const isExpanded = expandedForMessage.includes(emoji);

                      const myReactionEmoji2 =
                        item.reactions &&
                        Object.entries(item.reactions).find(([_, u]) => u.includes(userName))?.[0];

                      const hasReacted = myReactionEmoji2 === emoji;

                      return (
                        <View key={emoji} style={styles.reactionContainer}>
                          <View style={styles.reactionTopRow}>
                            <Pressable
                              onPress={() => {
                                setExpandedReactions(prevState => {
                                  const next = { ...prevState };
                                  const current = next[item.id] || [];

                                  if (current.includes(emoji)) {
                                    next[item.id] = current.filter(e => e !== emoji);
                                  } else {
                                    next[item.id] = [...current, emoji];
                                  }

                                  return next;
                                });
                              }}
                            >
                              <View style={[styles.reactionBubble, hasReacted && styles.reactionBubbleActive]}>
                                <Text>
                                  {emoji} {users.length}
                                </Text>
                              </View>
                            </Pressable>

                            {hasReacted && (
                              <Pressable style={styles.removeReaction} onPress={() => handleReaction(item.id, emoji)}>
                                <Text style={styles.removeReactionText}>×</Text>
                              </Pressable>
                            )}
                          </View>

                          {isExpanded && (
                            <View style={styles.reactionBottomRow}>
                              <Text
                                style={[
                                  styles.reactionNames,
                                  hasBackground && styles.darkSubText
                                ]}
                              >
                                {users.join(", ")}
                              </Text>
                              {!hasReacted && (
                                <Pressable
                                  style={styles.addReactionButton}
                                  onPress={() => handleReaction(item.id, emoji)}
                                >
                                  <Image
                                    source={require("../assets/images/imageGraphic.jpg")}
                                    style={styles.mediaIcon}
                                    resizeMode="contain"
                                  />
                                </Pressable>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
              </View>
            </View>
          );
        }}
      />

      <Modal visible={showRequestsModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center" }}>
          <View style={{ backgroundColor: "white", margin: 20, padding: 16, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Join Requests</Text>

            {requestUsers.length === 0 && <Text>No pending join requests</Text>}

            <FlatList
              data={requestUsers}
              keyExtractor={item => item.uid}
              renderItem={({ item }) => (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontWeight: "600" }}>{item.name}</Text>
                  <Text style={{ color: "#6B7280", marginTop: 2 }}>
                    {item.position ? item.position : "No position provided"}
                  </Text>

                  <View style={{ flexDirection: "row", marginTop: 6 }}>
                    <Pressable style={[styles.send, { marginRight: 8 }]} onPress={() => acceptJoinRequest(item)}>
                      <Text style={styles.sendText}>Accept</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.send, { backgroundColor: "#9CA3AF" }]}
                      onPress={() => rejectJoinRequest(item)}
                    >
                      <Text style={styles.sendText}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            />

            <Pressable onPress={() => setShowRequestsModal(false)}>
              <Text style={{ textAlign: "center", marginTop: 12 }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {showEmojiPicker && (
        <TextInput
          ref={emojiInputRef}
          value={emojiInput}
          onChangeText={text => {
            if (isSingleEmoji(text)) {
              handleReaction(activeMessageId as string, text);
              setEmojiInput("");
              setShowEmojiPicker(false);
            } else {
              setEmojiInput("");
            }
          }}
          style={{ height: 0, width: 0 }}
        />
      )}

      {!showEmojiPicker && (
        <View>
          {!!pendingMediaBase64 && (
            <View style={styles.pendingMediaWrap}>
              <Image source={{ uri: `data:image/jpeg;base64,${pendingMediaBase64}` }} style={styles.pendingMediaImage} />
              <Pressable style={styles.pendingRemove} onPress={() => setPendingMediaBase64(null)} disabled={isSending}>
                <Text style={styles.pendingRemoveText}>×</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.row}>
            <Pressable style={styles.mediaButton} onPress={pickMedia} disabled={isPickingMedia || isSending}>
              <Image
                source={require("../assets/images/imageGraphic.jpg")}
                style={styles.mediaIcon}
                resizeMode="contain"
              />
            </Pressable>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type message here..."
              placeholderTextColor="black"
              style={styles.input}
              editable={!isSending}
            />
            <Pressable style={styles.send} onPress={sendMessage} disabled={isSending}>
              <Text style={styles.sendText}>{isSending ? "..." : "Send"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      {(() => {
        const ChatScreenContent = (
          <View
            style={[
              styles.container,
              chatBackgroundBase64 && { backgroundColor: "transparent" }
            ]}
          >
            {/* <View style={styles.headerTopRow}>
              <Pressable onPress={() =>
                  router.push({
                    pathname: "/calendar",
                    params: { clubId: selectedClubId }
                  })
                }
              >
                <Image
                  source={require("../assets/images/calendarGraphic.png")}
                  style={styles.clubHeaderImage}
                  resizeMode="contain"
                />
              </Pressable>

              <View style={styles.headerCenterWrap}>
                <Text style={styles.clubHeader}>{clubName}</Text>

                <Text style={styles.userHeader}>
                  {userName} · {position}
                </Text>
              </View>

              <View style={styles.headerRightSpacer} />
            </View> */}

            <View style={styles.headerTopRow}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/calendar",
                    params: { clubId: selectedClubId }
                  })
                }
              >
                <Image
                  source={require("../assets/images/calendarGraphic.png")}
                  style={styles.clubHeaderImage}
                  resizeMode="contain"
                />
              </Pressable>

              <View style={styles.headerCenterWrap}>
                <Text style={styles.clubHeader}>{clubName}</Text>

                <Text style={styles.userHeader}>
                  {userName} · {position}
                </Text>
              </View>

              {isPresident ? (
                <Pressable
                  onPress={() => setShowRequestsModal(true)}
                  style={{ padding: 4 }}
                >
                  <Image
                    source={require("../assets/images/usersGraphic.png")}
                    style={styles.clubHeaderImage}
                    resizeMode="contain"
                  />
                </Pressable>
              ) : (
                <View style={styles.headerRightSpacer} />
              )}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
              {/* <Pressable
                style={styles.openCalendarButton}
                onPress={() =>
                  router.push({
                    pathname: "/calendar",
                    params: { clubId: selectedClubId }
                  })
                }
              >
                <Text style={styles.openCalendarText}>View Calendar</Text>
              </Pressable> */}

              {/* {isPresident && (
                <Pressable
                  style={styles.openCalendarButton}
                  onPress={() => setShowRequestsModal(true)}
                >
                  <Text style={styles.openCalendarText}>Join Requests</Text>
                </Pressable>
              )} */}
            </View>

            {isPresident && (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
                <Pressable
                  style={styles.openCalendarButton}
                  onPress={pickChatBackground}
                  disabled={isPickingBackground}
                >
                  <Text style={styles.openCalendarText}>
                    {isPickingBackground ? "..." : "Chat Background"}
                  </Text>
                </Pressable>

                {!!chatBackgroundBase64 && (
                  <Pressable
                    style={styles.openCalendarButton}
                    onPress={clearChatBackground}
                  >
                    <Text style={styles.openCalendarText}>Remove Background</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View style={styles.chatArea}>{ChatBody}</View>
          </View>
        );

        return chatBackgroundBase64 ? (
          <ImageBackground
            source={{ uri: `data:image/jpeg;base64,${chatBackgroundBase64}` }}
            style={{ flex: 1 }}
            resizeMode="cover"
          >
            <View style={styles.screenOverlay}>{ChatScreenContent}</View>
          </ImageBackground>
        ) : (
          ChatScreenContent
        );
      })()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: "white"
  },
  clubHeader: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4
  },
  userHeader: {
    textAlign: "center",
    fontSize: 14,
    marginBottom: 8,
    color: "#000000"
  },
  chatArea: {
    flex: 1,
    marginTop: 10
  },
  chatBg: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden"
  },
  chatBgOverlay: {
    flex: 1,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.35)"
  },
  pinnedWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 45,
    borderColor: "#E5E7EB",
    backgroundColor: "rgba(255,255,255,0.85)",
    marginBottom: 10,
    overflow: "hidden"
  },
  pinnedLeftBar: {
    width: 6,
    alignSelf: "stretch",
    backgroundColor: "#224bc5"
  },
  pinnedContent: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  pinnedTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
    marginLeft: 4
  },
  pinnedText: {
    fontSize: 12,
    color: "#374151",
    marginLeft: 4
  },
  pinnedMessageOutline: {
    borderWidth: 2,
    borderColor: "#224bc5"
  },
  pinnedTimeText: {
    marginRight: 8,
    fontSize: 11,
    color: "#000000"
  },
  dayHeaderWrap: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 6
  },
  dayHeaderText: {
    fontSize: 12,
    color: "#6B7280"
  },
  sender: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2
  },
  message: {
    padding: 10,
    borderRadius: 6,
    marginVertical: 4,
    backgroundColor: "#E5E5E5"
  },
  reactButton: {
    marginLeft: 6
  },
  reactText: {
    fontSize: 13,
    color: "#6B7280"
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    borderTopWidth: 1,
    borderColor: "#E5E7EB"
  },
  emoji: {
    fontSize: 24
  },
  row: {
    flexDirection: "row",
    marginTop: 10,
    alignItems: "center"
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    fontSize: 12,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: "white"
  },
  send: {
    height: 48,
    backgroundColor: "#7b97d4",
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 8
  },
  sendText: {
    color: "white",
    fontWeight: "600"
  },
  openCalendarButton: {
    backgroundColor: "#7b97d4",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignSelf: "center",
    marginTop: 10
  },
  openCalendarText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600"
  },
  emojiPickerContainer: {
    height: 320,
    borderTopWidth: 1,
    borderColor: "#E5E7EB"
  },
  removeReaction: {
    marginLeft: 6,
    paddingHorizontal: 4
  },
  removeReactionText: {
    fontSize: 14,
    color: "#6B7280"
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#DBEAFE"
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#E5E5E5"
  },
  myMessageText: {
    color: "#000"
  },
  otherMessageText: {
    color: "#000"
  },
  messageGroup: {
    maxWidth: "80%",
    marginVertical: 6
  },
  alignRight: {
    alignSelf: "flex-end",
    alignItems: "flex-end"
  },
  alignLeft: {
    alignSelf: "flex-start",
    alignItems: "flex-start"
  },
  reactionNames: {
    marginLeft: 6,
    fontSize: 12,
    color: "#374151"
  },
  addReactionButton: {
    marginLeft: 6,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  addReactionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280"
  },
  reactionBubbleActive: {
    backgroundColor: "#7b97d4"
  },
  reactionBubble: {
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  reactionContainer: {
    marginLeft: 6,
    marginTop: 2
  },
  reactionTopRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  reactionBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2
  },
  reactRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  reactTimeText: {
    marginLeft: 8,
    fontSize: 11,
    color: "#6B7280"
  },
  mediaButton: {
    height: 48,
    width: 48,
    borderRadius: 8,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E5E5"
  },
  mediaButtonText: {
    fontSize: 22,
    color: "#111827",
    fontWeight: "700"
  },
  chatImage: {
    width: 220,
    height: 220,
    borderRadius: 10,
    marginTop: 6,
    marginBottom: 6
  },
  pendingMediaWrap: {
    marginTop: 10,
    marginBottom: 6,
    alignSelf: "flex-start"
  },
  pendingMediaImage: {
    width: 160,
    height: 160,
    borderRadius: 10
  },
  pendingRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center"
  },
  pendingRemoveText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18
  },
  mediaIcon: {
    width: 44,
    height: 44,
    borderRadius: 6
  },
  darkOverlayText: {
    color: "#111111",
    fontWeight: "600"
  },
  darkSubText: {
    color: "#111111"
  },
  screenOverlay: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.25)"
  },
  unreadMessageHighlight: {
    borderWidth: 2,
    borderColor: "#25D366",
    backgroundColor: "#DCFCE7"
  },
  headerTopRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 8
  },
  clubHeaderImage: {
    width: 48,
    height: 48,
    marginRight: 5,
    marginLeft: 5
  },
  headerTextWrap: {
    alignItems: "flex-start"
  },
  headerCenterWrap: {
    flex: 1,
    alignItems: "center"
  },
  headerRightSpacer: {
    width: 52
  },
});