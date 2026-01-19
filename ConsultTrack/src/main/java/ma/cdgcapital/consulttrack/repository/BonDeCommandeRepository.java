package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.BonDeCommande;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface BonDeCommandeRepository extends JpaRepository<BonDeCommande, Long> {

    // Option A : Utiliser la convention de nommage correcte (propriété 'id' de l'objet 'consultant')
    List<BonDeCommande> findByConsultant_Id(Long consultantId);

    // Option B (Plus robuste) : Utiliser une requête JPQL explicite
    @Query("SELECT b FROM BonDeCommande b WHERE b.consultant.id = :consultantId")
    List<BonDeCommande> findByConsultantId(@Param("consultantId") Long consultantId);
}