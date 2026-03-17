import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import MapView, { MapPressEvent, Marker, Region } from "react-native-maps";

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
};

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export default function MapPickerScreen() {
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView | null>(null);

  const initialLat =
    typeof params.initialLat === "string" ? Number(params.initialLat) : null;
  const initialLng =
    typeof params.initialLng === "string" ? Number(params.initialLng) : null;
  const initialName =
    typeof params.initialName === "string" ? params.initialName : "";
  const initialAddress =
    typeof params.initialAddress === "string" ? params.initialAddress : "";

  const [locationName, setLocationName] = useState(initialName);
  const [locationAddress, setLocationAddress] = useState(initialAddress);
  const [searchText, setSearchText] = useState(initialAddress || initialName);
  const [placeSelected, setPlaceSelected] = useState(false);

  const [pickedLat, setPickedLat] = useState<number | null>(
    typeof initialLat === "number" && !Number.isNaN(initialLat)
      ? initialLat
      : null
  );
  const [pickedLng, setPickedLng] = useState<number | null>(
    typeof initialLng === "number" && !Number.isNaN(initialLng)
      ? initialLng
      : null
  );

  const [region, setRegion] = useState<Region>({
    latitude: pickedLat ?? 42.0334,
    longitude: pickedLng ?? -88.0834,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08
  });

  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingPlace, setLoadingPlace] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const loadUserLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status !== "granted") {
          return;
        }

        const current = await Location.getCurrentPositionAsync({});
        const coords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude
        };

        setUserCoords(coords);

        if (pickedLat === null || pickedLng === null) {
          const nextRegion = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08
          };
          setRegion(nextRegion);
          mapRef.current?.animateToRegion(nextRegion, 500);
        }
      } catch {
      }
    };

    loadUserLocation();
  }, [pickedLat, pickedLng]);

  useEffect(() => {
    if (placeSelected) return;

    const trimmed = searchText.trim();

    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(() => {
      fetchAutocomplete(trimmed);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchText, userCoords, placeSelected]);

  const markerCoords = useMemo(() => {
    if (pickedLat === null || pickedLng === null) return null;

    return {
      latitude: pickedLat,
      longitude: pickedLng
    };
  }, [pickedLat, pickedLng]);

  const fetchAutocomplete = async (input: string) => {
    try {
      setLoadingSuggestions(true);

      const body: any = {
        input,
        includeQueryPredictions: false,
        includedRegionCodes: ["us"]
      };

      if (userCoords) {
        body.locationBias = {
          circle: {
            center: {
              latitude: userCoords.latitude,
              longitude: userCoords.longitude
            },
            radius: 25000
          }
        };
      }

      const response = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_API_KEY
          },
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.log("Autocomplete error:", data);
        setSuggestions([]);
        return;
      }

      const nextSuggestions: Suggestion[] = (data.suggestions || [])
        .map((item: any) => {
          const prediction = item.placePrediction;
          if (!prediction?.placeId) return null;

          return {
            placeId: prediction.placeId,
            mainText:
              prediction.structuredFormat?.mainText?.text ||
              prediction.text?.text ||
              "",
            secondaryText:
              prediction.structuredFormat?.secondaryText?.text || "",
            fullText: prediction.text?.text || ""
          };
        })
        .filter(Boolean);

      setSuggestions(nextSuggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.log("Autocomplete fetch failed:", error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const fetchPlaceDetails = async (suggestion: Suggestion) => {
    if (!GOOGLE_API_KEY) {
      Alert.alert("Missing API key", "Add your Google Maps API key first.");
      return;
    }

    try {
      setLoadingPlace(true);
      Keyboard.dismiss();

      const response = await fetch(
        `https://places.googleapis.com/v1/places/${suggestion.placeId}`,
        {
          method: "GET",
          headers: {
            "X-Goog-Api-Key": GOOGLE_API_KEY,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,location"
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.log("Place details error:", data);
        Alert.alert("Search error", "Could not load that place.");
        return;
      }

      const lat = data.location?.latitude;
      const lng = data.location?.longitude;

      if (typeof lat !== "number" || typeof lng !== "number") {
        Alert.alert("Search error", "That place did not return coordinates.");
        return;
      }

      const placeName =
        data.displayName?.text ||
        suggestion.mainText ||
        suggestion.fullText ||
        "Pinned location";

      const addressOnly =
        data.formattedAddress ||
        suggestion.secondaryText ||
        suggestion.fullText ||
        "";

      setPickedLat(lat);
      setPickedLng(lng);
      setLocationName(placeName);
      setLocationAddress(addressOnly);
      setSearchText(addressOnly || placeName);
      setSuggestions([]);
      setShowSuggestions(false);

      setPlaceSelected(true);
      setSuggestions([]);
      setShowSuggestions(false);

      const nextRegion = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02
      };

      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 500);
    } catch (error) {
      console.log("Place details fetch failed:", error);
      Alert.alert("Search error", "Could not load that place.");
    } finally {
      setLoadingPlace(false);
    }
  };

  const reverseGeocodeAddress = async (latitude: number, longitude: number) => {
    if (!GOOGLE_API_KEY) {
      return "";
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`
      );

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address || "";
      }

      return "";
    } catch (error) {
      console.log("Reverse geocoding error:", error);
      return "";
    }
  };

  const handleMapPress = async (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    setPickedLat(latitude);
    setPickedLng(longitude);
    setShowSuggestions(false);
    Keyboard.dismiss();

    const address = await reverseGeocodeAddress(latitude, longitude);

    setLocationAddress(address);

    if (!locationName.trim()) {
      setLocationName(address || "Pinned location");
    }

    setSearchText(address || locationName || "Pinned location");
  };

  const handleConfirm = () => {
    if (pickedLat === null || pickedLng === null) {
      Alert.alert("Pick a location", "Search for a place or tap on the map.");
      return;
    }

    router.dismissTo({
      pathname: "/add-event",
      params: {
        locationName: locationName.trim() || "Pinned location",
        locationAddress:
          locationAddress.trim() || locationName.trim() || "Pinned location",
        lat: String(pickedLat),
        lng: String(pickedLng)
      }
    });
  };

  return (
    <ScrollView
    style={{ flex: 1 }}
    contentContainerStyle={{ paddingBottom: 30 }}
    keyboardShouldPersistTaps="handled"
  >
    <View style={styles.container}>
      <Text style={styles.header}>Pick Event Location</Text>

      <View style={styles.searchWrap}>
        <TextInput
          placeholder="Search a place or address"
          placeholderTextColor="#6B7280"
          value={searchText}
          onChangeText={text => {
            setSearchText(text);
            setPlaceSelected(false);
            setShowSuggestions(true);
          }}
          style={styles.input}
        />

        {(loadingSuggestions || loadingPlace) && (
          <ActivityIndicator style={styles.loader} size="small" color="#2563EB" />
        )}

        {showSuggestions && suggestions.length > 0 && searchText.trim().length >= 2 && (
          <View style={styles.suggestionsBox}>
            {suggestions.map(item => (
              <Pressable
                key={item.placeId}
                style={styles.suggestionItem}
                onPress={() => fetchPlaceDetails(item)}
              >
                <Text style={styles.suggestionMain}>{item.mainText}</Text>
                {!!item.secondaryText && (
                  <Text style={styles.suggestionSecondary}>
                    {item.secondaryText}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.nameBox}>
        <Text style={styles.nameLabel}>Calendar name</Text>
        <TextInput
          placeholder="Ex. Taco Bell"
          placeholderTextColor="#6B7280"
          value={locationName}
          onChangeText={setLocationName}
          style={styles.nameInput}
        />
      </View>

      {!!locationAddress && (
        <View style={styles.addressBox}>
          <Text style={styles.addressLabel}>Selected address</Text>
          <Text style={styles.addressText}>{locationAddress}</Text>
        </View>
      )}

      <Text style={styles.helper}>
        Search above or tap anywhere on the map to place your pin.
      </Text>

      <MapView
        ref={ref => {
          mapRef.current = ref;
        }}
        style={styles.map}
        initialRegion={region}
        onPress={handleMapPress}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {markerCoords && <Marker coordinate={markerCoords} />}

        {/* {userCoords && (
          <Marker
            coordinate={userCoords}
            title="Your Location"
            pinColor="blue"
          />
        )} */}
      </MapView>

      {markerCoords && (
        <Text style={styles.coords}>
          {markerCoords.latitude.toFixed(5)}, {markerCoords.longitude.toFixed(5)}
        </Text>
      )}

      <View style={styles.buttonRow}>
        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Use This Location</Text>
        </Pressable>
      </View>
    </View>
  </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dbeafe",
    padding: 16
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    color: "#111827",
    marginBottom: 12
  },
  searchWrap: {
    zIndex: 20,
    marginBottom: 8
  },
  input: {
    backgroundColor: "white",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingRight: 42,
    borderWidth: 1,
    borderColor: "#D1D5DB"
  },
  loader: {
    position: "absolute",
    right: 12,
    top: 13
  },
  suggestionsBox: {
    backgroundColor: "white",
    borderRadius: 10,
    marginTop: 6,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    overflow: "hidden"
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  suggestionMain: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "600"
  },
  suggestionSecondary: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 2
  },
  nameBox: {
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 12,
    marginBottom: 8
  },
  nameLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6
  },
  nameInput: {
    fontSize: 15,
    color: "#111827"
  },
  addressBox: {
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 12,
    marginBottom: 8
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4
  },
  addressText: {
    color: "#111827",
    fontSize: 14
  },
  helper: {
    color: "#374151",
    marginBottom: 10
  },
  map: {
  height: 420,
  borderRadius: 12,
  overflow: "hidden",
  marginBottom: 10
},
  coords: {
    marginTop: 10,
    color: "#374151",
    textAlign: "center"
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 10
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    padding: 14,
    borderRadius: 10
  },
  cancelButtonText: {
    textAlign: "center",
    fontWeight: "600",
    color: "#111827"
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 10
  },
  confirmButtonText: {
    textAlign: "center",
    fontWeight: "600",
    color: "white"
  }
});