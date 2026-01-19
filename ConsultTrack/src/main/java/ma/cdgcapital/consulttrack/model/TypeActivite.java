package ma.cdgcapital.consulttrack.model;

public enum TypeActivite {
    // Types liés au PROJET
    CADRAGE(NatureActivite.PROJET),
    CONCEPTION(NatureActivite.PROJET),
    DEVELOPPEMENT(NatureActivite.PROJET),
    RECETTE(NatureActivite.PROJET),
    MISE_EN_PRODUCTION(NatureActivite.PROJET),
    DESIGN(NatureActivite.PROJET),
    FORMATION(NatureActivite.PROJET),

    // Types liés au RUN
    MAINTENANCE(NatureActivite.RUN),
    CORRECTIF(NatureActivite.RUN),
    ANOMALIE(NatureActivite.RUN),
    EVOLUTION(NatureActivite.RUN),
    SUPPORT(NatureActivite.RUN),
    MONITORING(NatureActivite.RUN),
    PASSATION(NatureActivite.RUN);

    private final NatureActivite nature;

    TypeActivite(NatureActivite nature) {
        this.nature = nature;
    }

    public NatureActivite getNature() {
        return nature;
    }
}