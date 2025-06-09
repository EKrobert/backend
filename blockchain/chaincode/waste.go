package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// Waste représente un déchet agricole dans la blockchain
type Waste struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Quantity    int    `json:"quantity"`
	HarvestDate string `json:"harvestDate"`
	Status      string `json:"status"`
	Owner       string `json:"owner"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// SmartContract gère les opérations sur les déchets
type SmartContract struct {
	contractapi.Contract
}

// InitLedger initialise le ledger avec des données de test
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	wastes := []Waste{
		{
			ID:          "waste1",
			Type:        "Olives",
			Quantity:    50,
			HarvestDate: "2023-10-01",
			Status:      "READY",
			Owner:       "farmer1",
			CreatedAt:   time.Now().Format(time.RFC3339),
			UpdatedAt:   time.Now().Format(time.RFC3339),
		},
	}

	for _, waste := range wastes {
		err := s.saveWaste(ctx, waste)
		if err != nil {
			return fmt.Errorf("failed to initialize ledger: %v", err)
		}
	}
	return nil
}

// CreateWaste ajoute un nouveau déchet au ledger
func (s *SmartContract) CreateWaste(
	ctx contractapi.TransactionContextInterface,
	id string,
	wasteType string,
	quantity string,
	harvestDate string,
	status string,
	owner string,
) error {
	// Validation des entrées
	if id == "" {
		return fmt.Errorf("l'ID ne peut pas être vide")
	}

	qty, err := strconv.Atoi(quantity)
	if err != nil || qty <= 0 {
		return fmt.Errorf("la quantité doit être un nombre positif")
	}

	if _, err := time.Parse("2006-01-02", harvestDate); err != nil {
		return fmt.Errorf("format de date invalide (utiliser YYYY-MM-DD)")
	}

	// Vérification des doublons
	existing, err := ctx.GetStub().GetState(id)
	if err != nil {
		return fmt.Errorf("échec de lecture du ledger: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("un déchet avec l'ID %s existe déjà", id)
	}

	// Création du déchet
	waste := Waste{
		ID:          id,
		Type:        wasteType,
		Quantity:    qty,
		HarvestDate: harvestDate,
		Status:      status,
		Owner:       owner,
		CreatedAt:   time.Now().Format(time.RFC3339),
		UpdatedAt:   time.Now().Format(time.RFC3339),
	}

	return s.saveWaste(ctx, waste)
}

// GetWaste récupère un déchet par son ID
func (s *SmartContract) GetWaste(ctx contractapi.TransactionContextInterface, id string) (*Waste, error) {
	wasteJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("échec de lecture du ledger: %v", err)
	}
	if wasteJSON == nil {
		return nil, fmt.Errorf("le déchet %s n'existe pas", id)
	}

	var waste Waste
	err = json.Unmarshal(wasteJSON, &waste)
	if err != nil {
		return nil, fmt.Errorf("échec de décodage JSON: %v", err)
	}

	return &waste, nil
}

// UpdateWasteStatus met à jour le statut d'un déchet
func (s *SmartContract) UpdateWasteStatus(
	ctx contractapi.TransactionContextInterface,
	id string,
	newStatus string,
) error {
	waste, err := s.GetWaste(ctx, id)
	if err != nil {
		return err
	}

	waste.Status = newStatus
	waste.UpdatedAt = time.Now().Format(time.RFC3339)

	return s.saveWaste(ctx, *waste)
}

// GetAllWastes retourne tous les déchets du ledger
func (s *SmartContract) GetAllWastes(ctx contractapi.TransactionContextInterface) ([]*Waste, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("échec de lecture du ledger: %v", err)
	}
	defer resultsIterator.Close()

	var wastes []*Waste
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("erreur d'itération: %v", err)
		}

		var waste Waste
		err = json.Unmarshal(queryResponse.Value, &waste)
		if err != nil {
			return nil, fmt.Errorf("échec de décodage JSON: %v", err)
		}
		wastes = append(wastes, &waste)
	}

	return wastes, nil
}

// saveWaste helper function pour sauvegarder un déchet
func (s *SmartContract) saveWaste(ctx contractapi.TransactionContextInterface, waste Waste) error {
	wasteJSON, err := json.Marshal(waste)
	if err != nil {
		return fmt.Errorf("échec de sérialisation JSON: %v", err)
	}

	return ctx.GetStub().PutState(waste.ID, wasteJSON)
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Erreur lors de la création du chaincode: %v", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Erreur lors du démarrage du chaincode: %v", err)
	}
}