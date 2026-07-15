package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.JourFerie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface JourFerieRepository extends JpaRepository<JourFerie, Long> {
    List<JourFerie> findByDateBetweenOrderByDate(LocalDate start, LocalDate end);
    Optional<JourFerie> findByDate(LocalDate date);
    boolean existsByDate(LocalDate date);
}
