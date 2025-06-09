package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// Waste represents agricultural waste in the blockchain
type Waste struct {
	ID           string    `json:"id"`
	Type         string    `json:"type"`
	Quantity     float64   `json:"quantity"`
	HarvestDate  string    `json:"harvestDate"`
	Status       string    `json:"status"`
	Owner        string    `json:"owner"`
	Farm         string    `json:"farm,omitempty"`
	Location     string    `json:"location,omitempty"`
	CreatedAt    string    `json:"createdAt"`
	UpdatedAt    string    `json:"updatedAt"`
	History      []History `json:"history"`
}

// Extraction represents the extraction process
type Extraction struct {
	ID             string    `json:"id"`
	WasteID        string    `json:"wasteId"`
	ProductType    string    `json:"productType"`
	Quantity       float64   `json:"quantity"`
	Quality        string    `json:"quality"`
	ExtractionDate string    `json:"extractionDate"`
	Processor      string    `json:"processor"`
	Status         string    `json:"status"`
	CreatedAt      string    `json:"createdAt"`
	History        []History `json:"history"`
}

// Recycling represents the recycling process
type Recycling struct {
	ID              string    `json:"id"`
	WasteID         string    `json:"wasteId"`
	RecycledProduct string    `json:"recycledProduct"`
	Quantity        float64   `json:"quantity"`
	Method          string    `json:"method"`
	RecyclingDate   string    `json:"recyclingDate"`
	Recycler        string    `json:"recycler"`
	Status          string    `json:"status"`
	CreatedAt       string    `json:"createdAt"`
	History         []History `json:"history"`
}

// History represents a change in the lifecycle
type History struct {
	Timestamp string `json:"timestamp"`
	Action    string `json:"action"`
	Actor     string `json:"actor"`
	Details   string `json:"details"`
}

// TraceabilityInfo provides complete traceability chain
type TraceabilityInfo struct {
	Waste      *Waste       `json:"waste,omitempty"`
	Extraction *Extraction  `json:"extraction,omitempty"`
	Recycling  *Recycling   `json:"recycling,omitempty"`
	Chain      []History    `json:"chain"`
}

// SmartContract manages all olive waste operations
type SmartContract struct {
	contractapi.Contract
}

// InitLedger initializes the ledger with sample data
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	fmt.Println("Initializing Green Olive Chain ledger...")
	
	// Sample waste data
	wastes := []Waste{
		{
			ID:          "waste1",
			Type:        "Olive Branches",
			Quantity:    50.5,
			HarvestDate: "2025-06-01",
			Status:      "COLLECTED",
			Owner:       "farmer1",
			Farm:        "Olive Farm Alpha",
			Location:    "Andalusia, Spain",
			CreatedAt:   time.Now().Format(time.RFC3339),
			UpdatedAt:   time.Now().Format(time.RFC3339),
			History: []History{
				{
					Timestamp: time.Now().Format(time.RFC3339),
					Action:    "CREATED",
					Actor:     "farmer1",
					Details:   "Initial waste collection",
				},
			},
		},
	}

	for _, waste := range wastes {
		wasteJSON, err := json.Marshal(waste)
		if err != nil {
			return err
		}

		err = ctx.GetStub().PutState("WASTE_"+waste.ID, wasteJSON)
		if err != nil {
			return fmt.Errorf("failed to put waste %s: %v", waste.ID, err)
		}
	}

	fmt.Println("Ledger initialized successfully")
	return nil
}

// CreateWaste adds new waste to the blockchain
func (s *SmartContract) CreateWaste(ctx contractapi.TransactionContextInterface, id string, wasteType string, quantity float64, harvestDate string, owner string, farm string, location string) error {
	// Check if waste already exists
	exists, err := s.WasteExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("waste %s already exists", id)
	}

	// Create new waste
	waste := Waste{
		ID:          id,
		Type:        wasteType,
		Quantity:    quantity,
		HarvestDate: harvestDate,
		Status:      "COLLECTED",
		Owner:       owner,
		Farm:        farm,
		Location:    location,
		CreatedAt:   time.Now().Format(time.RFC3339),
		UpdatedAt:   time.Now().Format(time.RFC3339),
		History: []History{
			{
				Timestamp: time.Now().Format(time.RFC3339),
				Action:    "CREATED",
				Actor:     owner,
				Details:   fmt.Sprintf("Waste collected: %s, Quantity: %.2f", wasteType, quantity),
			},
		},
	}

	wasteJSON, err := json.Marshal(waste)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState("WASTE_"+id, wasteJSON)
}

// ReadWaste returns the waste stored in the world state with given id
func (s *SmartContract) ReadWaste(ctx contractapi.TransactionContextInterface, id string) (*Waste, error) {
	wasteJSON, err := ctx.GetStub().GetState("WASTE_" + id)
	if err != nil {
		return nil, fmt.Errorf("failed to read waste %s: %v", id, err)
	}
	if wasteJSON == nil {
		return nil, fmt.Errorf("waste %s does not exist", id)
	}

	var waste Waste
	err = json.Unmarshal(wasteJSON, &waste)
	if err != nil {
		return nil, err
	}

	return &waste, nil
}

// UpdateWasteStatus updates the status of a waste item
func (s *SmartContract) UpdateWasteStatus(ctx contractapi.TransactionContextInterface, id string, newStatus string, actor string, details string) error {
	waste, err := s.ReadWaste(ctx, id)
	if err != nil {
		return err
	}

	// Update status
	oldStatus := waste.Status
	waste.Status = newStatus
	waste.UpdatedAt = time.Now().Format(time.RFC3339)

	// Add to history
	historyEntry := History{
		Timestamp: time.Now().Format(time.RFC3339),
		Action:    "STATUS_CHANGED",
		Actor:     actor,
		Details:   fmt.Sprintf("Status changed from %s to %s. %s", oldStatus, newStatus, details),
	}
	waste.History = append(waste.History, historyEntry)

	wasteJSON, err := json.Marshal(waste)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState("WASTE_"+id, wasteJSON)
}

// CreateExtraction records extraction process
func (s *SmartContract) CreateExtraction(ctx contractapi.TransactionContextInterface, id string, wasteId string, productType string, quantity float64, quality string, processor string) error {
	// Verify waste exists
	_, err := s.ReadWaste(ctx, wasteId)
	if err != nil {
		return fmt.Errorf("source waste not found: %v", err)
	}

	// Check if extraction already exists
	extractionJSON, err := ctx.GetStub().GetState("EXTRACTION_" + id)
	if err != nil {
		return err
	}
	if extractionJSON != nil {
		return fmt.Errorf("extraction %s already exists", id)
	}

	// Create extraction record
	extraction := Extraction{
		ID:             id,
		WasteID:        wasteId,
		ProductType:    productType,
		Quantity:       quantity,
		Quality:        quality,
		ExtractionDate: time.Now().Format(time.RFC3339),
		Processor:      processor,
		Status:         "PROCESSED",
		CreatedAt:      time.Now().Format(time.RFC3339),
		History: []History{
			{
				Timestamp: time.Now().Format(time.RFC3339),
				Action:    "EXTRACTED",
				Actor:     processor,
				Details:   fmt.Sprintf("Extracted %s (%.2f units) from waste %s", productType, quantity, wasteId),
			},
		},
	}

	extractionJSON, err = json.Marshal(extraction)
	if err != nil {
		return err
	}

	// Store extraction
	err = ctx.GetStub().PutState("EXTRACTION_"+id, extractionJSON)
	if err != nil {
		return err
	}

	// Update waste status
	return s.UpdateWasteStatus(ctx, wasteId, "PROCESSED", processor, fmt.Sprintf("Used for %s extraction", productType))
}

// CreateRecycling records recycling process
func (s *SmartContract) CreateRecycling(ctx contractapi.TransactionContextInterface, id string, wasteId string, recycledProduct string, quantity float64, method string, recycler string) error {
	// Verify waste exists
	_, err := s.ReadWaste(ctx, wasteId)
	if err != nil {
		return fmt.Errorf("source waste not found: %v", err)
	}

	// Check if recycling already exists
	recyclingJSON, err := ctx.GetStub().GetState("RECYCLING_" + id)
	if err != nil {
		return err
	}
	if recyclingJSON != nil {
		return fmt.Errorf("recycling %s already exists", id)
	}

	// Create recycling record
	recycling := Recycling{
		ID:              id,
		WasteID:         wasteId,
		RecycledProduct: recycledProduct,
		Quantity:        quantity,
		Method:          method,
		RecyclingDate:   time.Now().Format(time.RFC3339),
		Recycler:        recycler,
		Status:          "COMPLETED",
		CreatedAt:       time.Now().Format(time.RFC3339),
		History: []History{
			{
				Timestamp: time.Now().Format(time.RFC3339),
				Action:    "RECYCLED",
				Actor:     recycler,
				Details:   fmt.Sprintf("Recycled waste %s into %s (%.2f units) using %s", wasteId, recycledProduct, quantity, method),
			},
		},
	}

	recyclingJSON, err = json.Marshal(recycling)
	if err != nil {
		return err
	}

	// Store recycling
	err = ctx.GetStub().PutState("RECYCLING_"+id, recyclingJSON)
	if err != nil {
		return err
	}

	// Update waste status
	return s.UpdateWasteStatus(ctx, wasteId, "RECYCLED", recycler, fmt.Sprintf("Recycled into %s using %s", recycledProduct, method))
}

// GetAllWastes returns all waste items
func (s *SmartContract) GetAllWastes(ctx contractapi.TransactionContextInterface) ([]*Waste, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("WASTE_", "WASTE_~")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var wastes []*Waste
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var waste Waste
		err = json.Unmarshal(queryResponse.Value, &waste)
		if err != nil {
			return nil, err
		}
		wastes = append(wastes, &waste)
	}

	return wastes, nil
}

// GetAllExtractions returns all extraction records
func (s *SmartContract) GetAllExtractions(ctx contractapi.TransactionContextInterface) ([]*Extraction, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("EXTRACTION_", "EXTRACTION_~")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var extractions []*Extraction
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var extraction Extraction
		err = json.Unmarshal(queryResponse.Value, &extraction)
		if err != nil {
			return nil, err
		}
		extractions = append(extractions, &extraction)
	}

	return extractions, nil
}

// GetAllRecyclings returns all recycling records
func (s *SmartContract) GetAllRecyclings(ctx contractapi.TransactionContextInterface) ([]*Recycling, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("RECYCLING_", "RECYCLING_~")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var recyclings []*Recycling
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var recycling Recycling
		err = json.Unmarshal(queryResponse.Value, &recycling)
		if err != nil {
			return nil, err
		}
		recyclings = append(recyclings, &recycling)
	}

	return recyclings, nil
}

// GetTraceability provides complete traceability for a waste item
func (s *SmartContract) GetTraceability(ctx contractapi.TransactionContextInterface, wasteId string) (*TraceabilityInfo, error) {
	// Get waste
	waste, err := s.ReadWaste(ctx, wasteId)
	if err != nil {
		return nil, err
	}

	traceInfo := &TraceabilityInfo{
		Waste: waste,
		Chain: waste.History,
	}

	// Find related extractions
	extractionsIterator, err := ctx.GetStub().GetStateByRange("EXTRACTION_", "EXTRACTION_~")
	if err != nil {
		return nil, err
	}
	defer extractionsIterator.Close()

	for extractionsIterator.HasNext() {
		queryResponse, err := extractionsIterator.Next()
		if err != nil {
			continue
		}

		var extraction Extraction
		err = json.Unmarshal(queryResponse.Value, &extraction)
		if err != nil {
			continue
		}

		if extraction.WasteID == wasteId {
			traceInfo.Extraction = &extraction
			traceInfo.Chain = append(traceInfo.Chain, extraction.History...)
			break
		}
	}

	// Find related recyclings
	recyclingsIterator, err := ctx.GetStub().GetStateByRange("RECYCLING_", "RECYCLING_~")
	if err != nil {
		return nil, err
	}
	defer recyclingsIterator.Close()

	for recyclingsIterator.HasNext() {
		queryResponse, err := recyclingsIterator.Next()
		if err != nil {
			continue
		}

		var recycling Recycling
		err = json.Unmarshal(queryResponse.Value, &recycling)
		if err != nil {
			continue
		}

		if recycling.WasteID == wasteId {
			traceInfo.Recycling = &recycling
			traceInfo.Chain = append(traceInfo.Chain, recycling.History...)
			break
		}
	}

	return traceInfo, nil
}

// WasteExists returns true when waste with given ID exists in world state
func (s *SmartContract) WasteExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	wasteJSON, err := ctx.GetStub().GetState("WASTE_" + id)
	if err != nil {
		return false, fmt.Errorf("failed to read waste %s: %v", id, err)
	}

	return wasteJSON != nil, nil
}

// GetWasteHistory returns the history of changes for a waste item
func (s *SmartContract) GetWasteHistory(ctx contractapi.TransactionContextInterface, id string) ([]History, error) {
	waste, err := s.ReadWaste(ctx, id)
	if err != nil {
		return nil, err
	}

	return waste.History, nil
}

func main() {
	assetChaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error creating waste chaincode: %v", err)
		return
	}

	if err := assetChaincode.Start(); err != nil {
		fmt.Printf("Error starting waste chaincode: %v", err)
	}
}
