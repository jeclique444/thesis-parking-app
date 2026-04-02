// iParkBayan — Mock data and types
// Design: Civic Tech / Modern Filipino Urban Identity

export type SlotStatus = "available" | "occupied" | "reserved";

export interface ParkingSlot {
  id: string;
  label: string;
  status: SlotStatus;
  floor?: string;
  row?: string;
  is_pwd?: boolean;
  is_reservable?: boolean;
}

export interface ParkingLot {
  id: string;
  name: string;
  address: string;
  type: "private" | "public";
  totalSlots: number;
  availableSlots: number;
  distance: string;
  ratePerHour: number;
  openHours: string;
  lat: number;
  lng: number;
  slots: ParkingSlot[];
}

export interface Reservation {
  id: string;
  lotName: string;
  slotLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: string;
  amount: number;
  status: "active" | "completed" | "cancelled" | "pending";
  vehiclePlate: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  color: string;
  isDefault: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "reservation" | "availability" | "system";
}

// Mock Parking Lots - NOW USING REAL LIPA LOCATIONS
export const parkingLots: ParkingLot[] = [
  {
    id: "lot-1",
    name: "Robinsons Place Lipa",
    address: "Mataas Na Lupa, JP Laurel Highway",
    type: "private",
    totalSlots: 50,
    availableSlots: 14,
    distance: "1.2 km",
    ratePerHour: 30,
    openHours: "10:00 AM – 9:00 PM",
    lat: 13.9515,
    lng: 121.1630,
    slots: generateSlots(50, "RobLipa"),
  },
  {
    id: "lot-2",
    name: "De La Salle Lipa",
    address: "Pres. J.P. Laurel Highway",
    type: "private",
    totalSlots: 40,
    availableSlots: 5,
    distance: "0.5 km",
    ratePerHour: 20,
    openHours: "6:00 AM – 8:00 PM",
    lat: 13.9535,
    lng: 121.1610,
    slots: generateSlots(40, "DLSL"),
  },
  {
    id: "lot-3",
    name: "Lipa Public Market (Palengke)",
    address: "C.M. Recto Ave, Lipa City",
    type: "public",
    totalSlots: 30,
    availableSlots: 0, // Full parking example
    distance: "3.0 km",
    ratePerHour: 20,
    openHours: "4:00 AM – 7:00 PM",
    lat: 13.9405,
    lng: 121.1632,
    slots: generateSlots(30, "PubMkt"),
  },
  {
    id: "lot-4",
    name: "Zam Parking Area",
    address: "B. Morada Ave, Lipa City",
    type: "private",
    totalSlots: 20,
    availableSlots: 11,
    distance: "1.8 km",
    ratePerHour: 40,
    openHours: "8:00 AM – 10:00 PM",
    lat: 13.9425,
    lng: 121.1620,
    slots: generateSlots(20, "Zam"),
  },
  {
    id: "lot-5",
    name: "SM City Lipa",
    address: "Ayala Highway, Lipa City",
    type: "private",
    totalSlots: 100,
    availableSlots: 42,
    distance: "2.1 km",
    ratePerHour: 30,
    openHours: "10:00 AM – 10:00 PM",
    lat: 13.9453,
    lng: 121.1633,
    slots: generateSlots(100, "SMLipa"),
  }
];

function generateSlots(count: number, prefix: string): ParkingSlot[] {
  const statuses: SlotStatus[] = ["available", "occupied", "reserved"];
  const rows = ["A", "B", "C", "D", "E", "F"];
  return Array.from({ length: count }, (_, i) => {
    const row = rows[Math.floor(i / 10) % rows.length];
    const num = (i % 10) + 1;
    // Deterministic but varied status
    const statusIndex = (i * 7 + 3) % 10;
    const status: SlotStatus =
      statusIndex < 4 ? "available" : statusIndex < 8 ? "occupied" : "reserved";
    return {
      id: `${prefix.toLowerCase()}-slot-${i + 1}`,
      label: `${row}${num}`,
      status,
      floor: "G/F",
      row,
    };
  });
}

// Mock Reservations - Updated to match real lot names
export const mockReservations: Reservation[] = [
  {
    id: "res-001",
    lotName: "Robinsons Place Lipa",
    slotLabel: "A3",
    date: "Mar 20, 2026",
    startTime: "10:00 AM",
    endTime: "12:00 PM",
    duration: "2 hours",
    amount: 60,
    status: "active",
    vehiclePlate: "ABC 1234",
  },
  {
    id: "res-002",
    lotName: "De La Salle Lipa",
    slotLabel: "B2",
    date: "Mar 18, 2026",
    startTime: "2:00 PM",
    endTime: "5:00 PM",
    duration: "3 hours",
    amount: 60,
    status: "completed",
    vehiclePlate: "ABC 1234",
  },
  {
    id: "res-003",
    lotName: "SM City Lipa",
    slotLabel: "C1",
    date: "Mar 15, 2026",
    startTime: "8:00 AM",
    endTime: "10:00 AM",
    duration: "2 hours",
    amount: 60,
    status: "completed",
    vehiclePlate: "XYZ 5678",
  },
  {
    id: "res-004",
    lotName: "Zam Parking Area",
    slotLabel: "D4",
    date: "Mar 22, 2026",
    startTime: "9:00 AM",
    endTime: "11:00 AM",
    duration: "2 hours",
    amount: 80,
    status: "pending",
    vehiclePlate: "ABC 1234",
  },
];

// Mock Vehicles
export const mockVehicles: Vehicle[] = [
  { id: "v1", plate: "ABC 1234", model: "Toyota Vios", color: "White", isDefault: true },
  { id: "v2", plate: "XYZ 5678", model: "Honda City", color: "Silver", isDefault: false },
];

// Mock Notifications - Updated to match real lot names
export const mockNotifications: Notification[] = [
  {
    id: "n1",
    title: "Reservation Confirmed",
    message: "Your reservation at Robinsons Place Lipa (Slot A3) is confirmed for Mar 20 at 10:00 AM.",
    time: "2 min ago",
    read: false,
    type: "reservation",
  },
  {
    id: "n2",
    title: "Slot Now Available",
    message: "A parking slot at De La Salle Lipa is now available near your saved location.",
    time: "15 min ago",
    read: false,
    type: "availability",
  },
  {
    id: "n3",
    title: "Reservation Reminder",
    message: "Your reservation at Robinsons Place Lipa starts in 30 minutes. Please proceed to Slot A3.",
    time: "1 hr ago",
    read: true,
    type: "reservation",
  },
  {
    id: "n4",
    title: "Reservation Completed",
    message: "Your parking session at SM City Lipa has ended. Thank you for using iParkBayan!",
    time: "2 days ago",
    read: true,
    type: "system",
  },
];

// Admin stats
export const adminStats = {
  totalSlots: 240, // Updated to reflect new total slots
  availableSlots: 72,
  occupiedSlots: 130,
  reservedSlots: 38,
  todayReservations: 45,
  todayRevenue: 2450,
  activeUsers: 210,
  weeklyOccupancy: [62, 74, 58, 81, 69, 77, 65],
};