import { db } from "@/FirebaseConfig";
import { router } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const POSITION_OPTIONS = [
  "New Member",
  "Recurring Member",
  "Board Member",
  "Other Position"
] as const;

const SORT_OPTIONS = [
  "Alphabetical",
  "Members"
] as const;

const CLUB_FILTER_OPTIONS = [
  "All Clubs",
  "Joined Clubs",
  "Clubs Not Joined"
] as const;

type SortOption = (typeof SORT_OPTIONS)[number];
type ClubFilterOption = (typeof CLUB_FILTER_OPTIONS)[number];

export default function JoinClubScreen() {
  const auth = getAuth();
  const currentUid = auth.currentUser?.uid;

  const [searchText, setSearchText] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [otherPosition, setOtherPosition] = useState("");
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [clubResults, setClubResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [joinedClubIds, setJoinedClubIds] = useState<string[]>([]);
  const [pendingClubRequests, setPendingClubRequests] = useState<string[]>([]);
  const [positionOpenClubId, setPositionOpenClubId] = useState<string | null>(null);

  const [selectedSort, setSelectedSort] = useState<SortOption>("Alphabetical");
  const [selectedClubFilter, setSelectedClubFilter] =
    useState<ClubFilterOption>("All Clubs");
  const [selectedBadgeFilter, setSelectedBadgeFilter] = useState("All Focuses");

  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [showDropdownOpen, setShowDropdownOpen] = useState(false);
  const [badgeDropdownOpen, setBadgeDropdownOpen] = useState(false);

  const hasAutoNavigatedRef = useRef(false);

  // Tracks previous joined club count so the screen knows when a new club was added
  const previousClubCount = useRef(0);

  useEffect(() => {
    if (!currentUid) return;

    const userRef = doc(db, "users", currentUid);

    const unsub = onSnapshot(userRef, snap => {
      if (!snap.exists()) return;

      const data = snap.data();

      const nextJoinedClubIds = Array.isArray(data.clubIds) ? data.clubIds : [];
      const nextPendingClubRequests = Array.isArray(data.pendingClubRequests)
        ? data.pendingClubRequests
        : [];

      setJoinedClubIds(nextJoinedClubIds);
      setPendingClubRequests(nextPendingClubRequests);

      // If the user just got accepted into a new club, send them back to the dashboard once
      if (
        nextJoinedClubIds.length > previousClubCount.current &&
        previousClubCount.current !== 0 &&
        !hasAutoNavigatedRef.current
      ) {
        hasAutoNavigatedRef.current = true;
        router.dismissTo("/chat-dashboard");
      }

      previousClubCount.current = nextJoinedClubIds.length;
    });

    return unsub;
  }, [currentUid]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "clubs"), snap => {
      const clubs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setAllClubs(clubs);
    });

    return unsub;
  }, []);

  const badgeOptions = useMemo(() => {
    // Build a unique list of all focus badges used across clubs
    const badgeMap = new Map<string, string>();

    allClubs.forEach(club => {
      const focusBadges = Array.isArray(club.focusBadges) ? club.focusBadges : [];

      focusBadges.forEach((badge: any) => {
        if (typeof badge !== "string") return;

        const trimmed = badge.trim();
        if (!trimmed) return;

        const normalizedKey = trimmed.toLowerCase();
        if (!badgeMap.has(normalizedKey)) {
          badgeMap.set(normalizedKey, trimmed);
        }
      });
    });

    return ["All Focuses", ...Array.from(badgeMap.values()).sort((a, b) => a.localeCompare(b))];
  }, [allClubs]);

  useEffect(() => {
    if (
      selectedBadgeFilter !== "All Focuses" &&
      !badgeOptions.includes(selectedBadgeFilter)
    ) {
      setSelectedBadgeFilter("All Focuses");
    }
  }, [badgeOptions, selectedBadgeFilter]);

  useEffect(() => {
    const search = searchText.trim().toUpperCase();

    setError("");
    setSelectedPosition("");
    setOtherPosition("");
    setPositionOpenClubId(null);

    let results = [...allClubs];

    // Filter by join status
    if (selectedClubFilter === "Joined Clubs") {
      results = results.filter(club => joinedClubIds.includes(club.id));
    } else if (selectedClubFilter === "Clubs Not Joined") {
      results = results.filter(club => !joinedClubIds.includes(club.id));
    }

    // Filter by selected focus badge
    if (selectedBadgeFilter !== "All Focuses") {
      results = results.filter(club => {
        const focusBadges = Array.isArray(club.focusBadges) ? club.focusBadges : [];
        return focusBadges.some(
          (badge: any) =>
            typeof badge === "string" &&
            badge.trim().toLowerCase() === selectedBadgeFilter.trim().toLowerCase()
        );
      });
    }

    // Search by club name, club code, or focus badges
    if (search) {
      const words = search.split(/\s+/).filter(Boolean);

      results = results.filter(club => {
        const clubName =
          typeof club.name === "string" ? club.name.toUpperCase() : "";

        const clubCode =
          typeof club.clubCode === "string" ? club.clubCode.toUpperCase() : "";

        const focusBadges = Array.isArray(club.focusBadges)
          ? club.focusBadges
              .filter((badge: any) => typeof badge === "string")
              .join(" ")
              .toUpperCase()
          : "";

        return words.every(
          word =>
            clubName.includes(word) ||
            clubCode.includes(word) ||
            focusBadges.includes(word)
        );
      });
    }

    results.sort((a, b) => {
      if (selectedSort === "Members") {
        const aCount = Array.isArray(a.members) ? a.members.length : 0;
        const bCount = Array.isArray(b.members) ? b.members.length : 0;

        if (bCount !== aCount) {
          return bCount - aCount;
        }
      }

      const aName = typeof a.name === "string" ? a.name : "";
      const bName = typeof b.name === "string" ? b.name : "";
      return aName.localeCompare(bName);
    });

    setClubResults(results);

    if (results.length === 0) {
      setError("No clubs match your filters");
    }
  }, [
    searchText,
    allClubs,
    joinedClubIds,
    selectedSort,
    selectedClubFilter,
    selectedBadgeFilter
  ]);

  async function sendJoinRequest(clubResult: any) {
    if (!clubResult || !currentUid) return;

    const cleanOtherPosition = otherPosition.trim();

    let finalPosition = selectedPosition;

    if (!selectedPosition) {
      setError("Choose a position for this club");
      return;
    }

    if (selectedPosition === "Other Position") {
      if (!cleanOtherPosition) {
        setError("Enter your position for this club");
        return;
      }
      finalPosition = cleanOtherPosition;
    }

    if (joinedClubIds.includes(clubResult.id)) {
      setError("You are already in this club");
      return;
    }

    if (pendingClubRequests.includes(clubResult.id)) {
      setError("You already sent a request to this club");
      return;
    }

    const clubRef = doc(db, "clubs", clubResult.id);
    const userRef = doc(db, "users", currentUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      setError("User profile not found");
      return;
    }

    const userData = userSnap.data();
    const requesterName =
      typeof userData.name === "string" ? userData.name.trim() : "";

    await updateDoc(clubRef, {
      joinRequests: arrayUnion({
        uid: currentUid,
        name: requesterName,
        position: finalPosition,
        requestedAt: new Date()
      })
    });

    await updateDoc(userRef, {
      pendingClubRequests: arrayUnion(clubResult.id)
    });

    setError("");
    setSelectedPosition("");
    setOtherPosition("");
    setPositionOpenClubId(null);
  }

  function closeTopDropdowns() {
    setSortDropdownOpen(false);
    setShowDropdownOpen(false);
    setBadgeDropdownOpen(false);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Join a Club</Text>

      <TextInput
        placeholder="Search clubs"
        placeholderTextColor="#4B5563"
        value={searchText}
        onChangeText={setSearchText}
        autoCapitalize="characters"
        style={styles.input}
        onFocus={closeTopDropdowns}
      />

      <View style={styles.topFiltersRow}>
        <View style={styles.dropdownWrap}>
          <Text style={styles.dropdownLabel}>Sort</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => {
              // Toggle sort dropdown and close the others
              setSortDropdownOpen(prev => !prev);
              setShowDropdownOpen(false);
              setBadgeDropdownOpen(false);
            }}
          >
            <Text style={styles.dropdownButtonText}>{selectedSort}</Text>
            <Text style={styles.dropdownArrow}>{sortDropdownOpen ? "▲" : "▼"}</Text>
          </Pressable>

          {sortDropdownOpen && (
            <View style={styles.dropdownMenu}>
              {SORT_OPTIONS.map(option => {
                const isSelected = selectedSort === option;

                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.dropdownOption,
                      isSelected && styles.dropdownOptionSelected
                    ]}
                    onPress={() => {
                      // Save selected sort option and close the menu
                      setSelectedSort(option);
                      setSortDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        isSelected && styles.dropdownOptionTextSelected
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.dropdownWrap}>
          <Text style={styles.dropdownLabel}>Show</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => {
              // Toggle club-status dropdown and close the others
              setShowDropdownOpen(prev => !prev);
              setSortDropdownOpen(false);
              setBadgeDropdownOpen(false);
            }}
          >
            <Text style={styles.dropdownButtonText}>{selectedClubFilter}</Text>
            <Text style={styles.dropdownArrow}>{showDropdownOpen ? "▲" : "▼"}</Text>
          </Pressable>

          {showDropdownOpen && (
            <View style={styles.dropdownMenu}>
              {CLUB_FILTER_OPTIONS.map(option => {
                const isSelected = selectedClubFilter === option;

                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.dropdownOption,
                      isSelected && styles.dropdownOptionSelected
                    ]}
                    onPress={() => {
                      // Save selected club filter and close the menu
                      setSelectedClubFilter(option);
                      setShowDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        isSelected && styles.dropdownOptionTextSelected
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.dropdownWrap}>
          <Text style={styles.dropdownLabel}>Focus</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => {
              // Toggle focus-badge dropdown and close the others
              setBadgeDropdownOpen(prev => !prev);
              setSortDropdownOpen(false);
              setShowDropdownOpen(false);
            }}
          >
            <Text style={styles.dropdownButtonText} numberOfLines={1}>
              {selectedBadgeFilter}
            </Text>
            <Text style={styles.dropdownArrow}>{badgeDropdownOpen ? "▲" : "▼"}</Text>
          </Pressable>

          {badgeDropdownOpen && (
            <View style={styles.dropdownMenu}>
              {badgeOptions.map(option => {
                const isSelected = selectedBadgeFilter === option;

                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.dropdownOption,
                      isSelected && styles.dropdownOptionSelected
                    ]}
                    onPress={() => {
                      // Save selected badge filter and close the menu
                      setSelectedBadgeFilter(option);
                      setBadgeDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        isSelected && styles.dropdownOptionTextSelected
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <Text style={styles.searchHint}>
        {clubResults.length} club{clubResults.length === 1 ? "" : "s"} shown
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {clubResults.map(clubResult => {
        const currentClubAlreadyRequested = pendingClubRequests.includes(clubResult.id);
        const currentClubAlreadyJoined = joinedClubIds.includes(clubResult.id);
        const positionOpen = positionOpenClubId === clubResult.id;
        const memberCount = Array.isArray(clubResult.members)
          ? clubResult.members.length
          : 0;
        const focusBadges = Array.isArray(clubResult.focusBadges)
          ? clubResult.focusBadges.filter((badge: any) => typeof badge === "string" && badge.trim())
          : [];

        return (
          <View key={clubResult.id} style={styles.result}>
            <View>
              <Text style={styles.clubName}>{clubResult.name}</Text>
              <Text style={styles.clubCode}>
                Code: {clubResult.clubCode || "No Code"}
              </Text>
              <Text style={styles.memberCount}>Members: {memberCount}</Text>

              {!!focusBadges.length && (
                <View style={styles.badgesWrap}>
                  {focusBadges.map((badge: string) => (
                    <View key={`${clubResult.id}-${badge}`} style={styles.badge}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {currentClubAlreadyJoined ? (
              <Text style={styles.pendingText}>
                You are already in this club.
              </Text>
            ) : currentClubAlreadyRequested ? (
              <Text style={styles.pendingText}>
                Request sent. Waiting for approval.
              </Text>
            ) : (
              <>
                <Pressable
                  style={styles.positionHeader}
                  onPress={() => {
                    // Close top dropdowns before opening the position selector
                    closeTopDropdowns();

                    // Toggle the current club's position picker
                    if (positionOpen) {
                      setPositionOpenClubId(null);
                    } else {
                      setPositionOpenClubId(clubResult.id);
                      setSelectedPosition("");
                      setOtherPosition("");
                    }
                  }}
                >
                  <Text style={styles.positionTitle}>
                    Choose your position {positionOpen ? "▲" : "▼"}
                  </Text>
                </Pressable>

                {positionOpen && (
                  <View style={styles.positionOptionsWrap}>
                    {POSITION_OPTIONS.map(option => {
                      const isSelected = selectedPosition === option;

                      return (
                        <Pressable
                          key={option}
                          style={[
                            styles.positionOption,
                            isSelected && styles.positionOptionSelected
                          ]}
                          onPress={() => {
                            // Save selected position and clear custom text unless "Other Position" is chosen
                            setSelectedPosition(option);
                            if (option !== "Other Position") {
                              setOtherPosition("");
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.positionOptionText,
                              isSelected && styles.positionOptionTextSelected
                            ]}
                          >
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {positionOpen && selectedPosition === "Other Position" && (
                  <TextInput
                    placeholder="Enter your position"
                    placeholderTextColor="#4B5563"
                    value={otherPosition}
                    onChangeText={setOtherPosition}
                    style={styles.input}
                  />
                )}

                <Pressable
                  style={styles.joinButton}
                  onPress={() => sendJoinRequest(clubResult)}
                >
                  <Text style={styles.joinText}>Send Join Request</Text>
                </Pressable>
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white"
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 120
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center"
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
  topFiltersRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 1000,
    marginBottom: 8
  },
  dropdownWrap: {
    flex: 1,
    position: "relative"
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8
  },
  dropdownButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dropdownButtonText: {
    color: "#111827",
    fontWeight: "500",
    fontSize: 7,
    flex: 1,
    marginRight: 10
  },
  dropdownArrow: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600"
  },
  dropdownMenu: {
    position: "absolute",
    top: 78,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    zIndex: 2000,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: "hidden"
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "white"
  },
  dropdownOptionSelected: {
    backgroundColor: "#EEF2FF"
  },
  dropdownOptionText: {
    color: "#111827",
    fontWeight: "500", 
    fontSize: 9
  },
  dropdownOptionTextSelected: {
    color: "#365E95",
    fontWeight: "600"
  },
  searchHint: {
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 12,
    marginTop: 6
  },
  error: {
    marginTop: 12,
    color: "red",
    textAlign: "center"
  },
  result: {
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8
  },
  clubName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8
  },
  clubCode: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: -4,
    marginBottom: 4
  },
  memberCount: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8
  },
  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
    marginBottom: 4
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    marginRight: 8,
    marginBottom: 8
  },
  badgeText: {
    color: "#365E95",
    fontWeight: "600",
    fontSize: 12
  },
  positionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 10
  },
  positionOptionsWrap: {
    marginBottom: 12
  },
  positionOption: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: "white"
  },
  positionOptionSelected: {
    backgroundColor: "#7b97d4",
    borderColor: "#7b97d4"
  },
  positionOptionText: {
    color: "#111827",
    textAlign: "center",
    fontWeight: "500"
  },
  positionOptionTextSelected: {
    color: "white",
    fontWeight: "600"
  },
  joinButton: {
    backgroundColor: "#222",
    padding: 10,
    borderRadius: 6
  },
  joinText: {
    color: "white",
    textAlign: "center"
  },
  pendingText: {
    marginTop: 12,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 14
  },
  positionHeader: {
    marginBottom: 10
  }
});