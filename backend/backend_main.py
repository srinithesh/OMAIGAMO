from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Emission factors (kg CO2 per liter)
EMISSION_FACTORS = {
    "petrol": 2.3477,
    "diesel": 2.6893,
}

class VehicleInput(BaseModel):
    vehicle_type: str
    count: int
    fuel_type: str
    liters_per_vehicle: float

class EmissionsRequest(BaseModel):
    vehicles: List[VehicleInput]
    location: str
    year: int

@app.post("/api/emissions")
async def calculate_emissions(data: EmissionsRequest):
    results = []
    total_co2_kg = 0

    # Calculate per vehicle type
    for v in data.vehicles:
        ef = EMISSION_FACTORS[v.fuel_type.lower()]
        total_fuel = v.count * v.liters_per_vehicle
        co2_kg = total_fuel * ef
        results.append({
            "vehicle_type": v.vehicle_type,
            "fuel_type": v.fuel_type,
            "count": v.count,
            "total_fuel": total_fuel,
            "co2_kg": co2_kg
        })
        total_co2_kg += co2_kg

    total_co2_tons = total_co2_kg / 1000

    # Mock factors
    ozone_factor = 0.12
    climate_factor = 0.08
    glacier_factor = 0.04

    for r in results:
        co2_tons = r["co2_kg"] / 1000
        percent = (co2_tons / total_co2_tons * 100) if total_co2_tons else 0
        r.update({
            "co2_tons": co2_tons,
            "percent_of_total": percent,
            "ozone_impact_percent": co2_tons * ozone_factor / total_co2_tons * 100 if total_co2_tons else 0,
            "climate_change_percent": co2_tons * climate_factor / total_co2_tons * 100 if total_co2_tons else 0,
            "glacier_melt_percent": co2_tons * glacier_factor / total_co2_tons * 100 if total_co2_tons else 0,
        })

    # Projected emissions (simple +0.5% annual growth)
    years_ahead = max(data.year - 2025, 0)
    projected_tons = total_co2_tons * (1 + 0.005) ** years_ahead

    return {
        "location": data.location,
        "year": data.year,
        "vehicle_results": results,
        "total_co2_tons": total_co2_tons,
        "projected_co2_tons": projected_tons,
    }