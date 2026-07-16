package ma.cdgcapital.consulttrack.service.mapper;

import ma.cdgcapital.consulttrack.dto.*;
import ma.cdgcapital.consulttrack.model.*;

/**
 * Mappers statiques entité → DTO.
 * Évite d'exposer les entités JPA en sortie d'API (lazy loading, cycles,
 * champs internes comme {@code password}). La forme des DTOs est calquée sur
 * ce que consomme le frontend (voir les Javadoc des DTOs).
 */
public final class EntityMapper {

    private EntityMapper() {}

    public static ConsultantRefDTO toRef(Consultant c) {
        if (c == null) return null;
        return new ConsultantRefDTO(c.getId(), c.getNom(), c.getPrenom());
    }

    public static CabinetDTO toDto(Cabinet c) {
        if (c == null) return null;
        return new CabinetDTO(
                c.getId(), c.getNom(), c.getAdresse(), c.getTelephone(),
                c.getEmail(), c.getIce(), c.getIdentifiantFiscal(),
                c.getRc(), c.getPatente(), c.getRib());
    }

    public static ConsultantDTO toDto(Consultant c) {
        if (c == null) return null;
        return new ConsultantDTO(
                c.getId(), c.getNom(), c.getPrenom(), c.getEmail(),
                c.getRole() != null ? c.getRole().name() : null,
                toDto(c.getCabinet()));
    }

    public static BonDeCommandeDTO toDto(BonDeCommande bc) {
        if (bc == null) return null;
        Double max = bc.getJoursMax() != null ? bc.getJoursMax() : 0.0;
        Double engages = bc.getJoursEngages() != null ? bc.getJoursEngages() : 0.0;
        return new BonDeCommandeDTO(
                bc.getId(), bc.getReference(), bc.getCodeBudget(),
                bc.getDesignation(), bc.getTjm(), bc.getJoursMax(),
                bc.getJoursConsommes(), engages, max - engages,
                bc.getMontantConsomme(),
                bc.getStatut() != null ? bc.getStatut().name() : null,
                bc.getNature() != null ? bc.getNature().name() : null,
                bc.getAnneeBudgetaire(),
                bc.getConsultant() != null ? bc.getConsultant().getId() : null,
                toRef(bc.getConsultant()));
    }

    public static AbsenceDTO toDto(Absence a) {
        if (a == null) return null;
        return new AbsenceDTO(
                a.getId(),
                toRef(a.getConsultant()),
                a.getDate(),
                a.getStatut() != null ? a.getStatut().name() : null,
                a.getMotif(),
                a.getDemandeId());
    }

    public static TacheRealiseeDTO toDto(TacheRealisee t) {
        if (t == null) return null;
        BonDeCommande bc = t.getBonDeCommande();
        TacheRealiseeDTO dto = new TacheRealiseeDTO();
        dto.setId(t.getId());
        dto.setDate(t.getDate() != null ? t.getDate().toString() : null);
        dto.setDuree(t.getDuree());
        dto.setLibelleTache(t.getLibelleTache());
        dto.setProjet(t.getProjet());
        dto.setTicketJira(t.getTicketJira());
        dto.setMois(t.getMois());
        dto.setAnnee(t.getAnnee());
        dto.setType(t.getType() != null ? t.getType().name() : null);
        dto.setTypePrestation(t.getTypePrestation());
        dto.setStatut(t.getStatut() != null ? t.getStatut().name() : null);
        dto.setMotifRejet(t.getMotifRejet());
        dto.setModeSaisie(t.getModeSaisie());
        dto.setDescriptionTache(t.getDescriptionTache());
        dto.setBcId(bc != null ? bc.getId() : null);
        dto.setConsultant(toRef(t.getConsultant()));
        dto.setBonDeCommande(bc != null ? new BcRefDTO(bc.getId(), bc.getReference()) : null);
        return dto;
    }
}
