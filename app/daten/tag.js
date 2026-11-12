/* Gemockter Tag der Bodenabfertigung.
   Übernommen aus der letzten Prototyp-Fassung der Tagesdisposition
   (Docs/projects/bodenabfertigung/Prototypes/2026-09-30T09-36-00-871Z.html, Fassung 10),
   ausgelesen über deren Prüfschnittstelle nach „Tag zurücksetzen“. Alle Daten sind erfunden. */
Huelle.daten({
  titel: "Tagesdisposition",
  untertitel: "Bodenabfertigung · gemockter Tag",
  /* Pfad dieses Played Flows aus festen Kennungen: Projekt bodenabfertigung, Played Flow
     tagesdisposition (Netz: N-1). Der Fachbereich „Disposition“ steht im Netz nur als Name,
     ohne Kennung; er fehlt im Pfad, bis es ihn als Objekt gibt. Regeln gelten von hier nach oben. */
  pfad: "bodenabfertigung/tagesdisposition",
  netz: "N-1",
  objekte: {
    fluege: {
      "XA101": {"flug":"XA 101","muster":"A32N","position":"Gate A2","onBlock":"05:40","offBlock":"06:35"},
      "XB214": {"flug":"XB 214","muster":"B738","position":"Gate A4","onBlock":"06:10","offBlock":"07:00"},
      "XA337": {"flug":"XA 337","muster":"A20N","position":"Außenposition P7","onBlock":"06:35","offBlock":"07:40"},
      "XC508": {"flug":"XC 508","muster":"E195","position":"Gate B1","onBlock":"07:05","offBlock":"07:50"},
      "XB622": {"flug":"XB 622","muster":"B738","position":"Gate A2","onBlock":"07:40","offBlock":"08:40"},
      "XA745": {"flug":"XA 745","muster":"A321","position":"Außenposition P9","onBlock":"08:15","offBlock":"09:25"},
      "XC810": {"flug":"XC 810","muster":"E190","position":"Gate B3","onBlock":"08:50","offBlock":"09:40"},
      "XB933": {"flug":"XB 933","muster":"B739","position":"Gate A4","onBlock":"09:25","offBlock":"10:25"}
    },
    mitarbeiter: {
      "MA-01": {"kennung":"MA-01","name":"R. Aldinger","gruppe":"Ladegruppe 1","qualifikationen":["Entladen","Beladen"],"schichtStart":"05:00","schichtEnde":"13:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-02": {"kennung":"MA-02","name":"S. Brendel","gruppe":"Ladegruppe 1","qualifikationen":["Entladen","Beladen"],"schichtStart":"05:00","schichtEnde":"13:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-03": {"kennung":"MA-03","name":"T. Cordes","gruppe":"Ladegruppe 1","qualifikationen":["Entladen","Beladen","Innenraum-Cleaning"],"schichtStart":"05:00","schichtEnde":"13:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-04": {"kennung":"MA-04","name":"U. Dahlmann","gruppe":"Ladegruppe 1","qualifikationen":["Entladen","Beladen"],"schichtStart":"05:00","schichtEnde":"13:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-05": {"kennung":"MA-05","name":"V. Engström","gruppe":"Ladegruppe 2","qualifikationen":["Entladen","Beladen"],"schichtStart":"05:30","schichtEnde":"13:30","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-06": {"kennung":"MA-06","name":"W. Fiedler","gruppe":"Ladegruppe 2","qualifikationen":["Entladen","Beladen"],"schichtStart":"05:30","schichtEnde":"13:30","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-07": {"kennung":"MA-07","name":"X. Gruber","gruppe":"Ladegruppe 2","qualifikationen":["Entladen","Beladen"],"schichtStart":"05:30","schichtEnde":"13:30","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-08": {"kennung":"MA-08","name":"Y. Hauser","gruppe":"Ladegruppe 2","qualifikationen":["Entladen","Beladen","Innenraum-Cleaning"],"schichtStart":"05:30","schichtEnde":"13:30","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-09": {"kennung":"MA-09","name":"Z. Iversen","gruppe":"Ladegruppe 3","qualifikationen":["Entladen","Beladen"],"schichtStart":"06:00","schichtEnde":"14:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-10": {"kennung":"MA-10","name":"A. Jankowski","gruppe":"Ladegruppe 3","qualifikationen":["Entladen","Beladen"],"schichtStart":"06:00","schichtEnde":"14:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-11": {"kennung":"MA-11","name":"B. Kerner","gruppe":"Ladegruppe 3","qualifikationen":["Entladen","Beladen"],"schichtStart":"06:00","schichtEnde":"14:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-12": {"kennung":"MA-12","name":"C. Lubitz","gruppe":"Ladegruppe 3","qualifikationen":["Entladen","Beladen"],"schichtStart":"06:00","schichtEnde":"14:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-20": {"kennung":"MA-20","name":"D. Mahler","gruppe":"Tankdienst","qualifikationen":["Betanken"],"schichtStart":"05:00","schichtEnde":"13:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-21": {"kennung":"MA-21","name":"E. Novak","gruppe":"Tankdienst","qualifikationen":["Betanken"],"schichtStart":"05:00","schichtEnde":"13:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-22": {"kennung":"MA-22","name":"F. Ohlsen","gruppe":"Tankdienst","qualifikationen":["Betanken","Fäkalien entleeren"],"schichtStart":"05:00","schichtEnde":"13:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-30": {"kennung":"MA-30","name":"G. Pregler","gruppe":"Fäkaliendienst","qualifikationen":["Fäkalien entleeren"],"schichtStart":"05:30","schichtEnde":"13:30","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-31": {"kennung":"MA-31","name":"H. Quandt","gruppe":"Fäkaliendienst","qualifikationen":["Fäkalien entleeren"],"schichtStart":"05:30","schichtEnde":"13:30","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-40": {"kennung":"MA-40","name":"I. Reindl","gruppe":"Cleaning 1","qualifikationen":["Innenraum-Cleaning"],"schichtStart":"06:00","schichtEnde":"14:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-41": {"kennung":"MA-41","name":"J. Sattler","gruppe":"Cleaning 1","qualifikationen":["Innenraum-Cleaning"],"schichtStart":"06:00","schichtEnde":"14:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-42": {"kennung":"MA-42","name":"K. Tesar","gruppe":"Cleaning 2","qualifikationen":["Innenraum-Cleaning"],"schichtStart":"06:00","schichtEnde":"14:00","abwesend":false,"grund":null,"abwesendAb":null},
      "MA-43": {"kennung":"MA-43","name":"L. Urban","gruppe":"Cleaning 2","qualifikationen":["Innenraum-Cleaning"],"schichtStart":"06:00","schichtEnde":"14:00","abwesend":false,"grund":null,"abwesendAb":null}
    },
    auftraege: {
      "XA101-ENTL-01": {"kennung":"XA101-ENTL-01","flug":"XA 101","arbeit":"Entladen","mitarbeiter":"MA-01","start":"05:45","ende":"06:05"},
      "XA101-ENTL-02": {"kennung":"XA101-ENTL-02","flug":"XA 101","arbeit":"Entladen","mitarbeiter":"MA-02","start":"05:45","ende":"06:05"},
      "XA101-ENTL-03": {"kennung":"XA101-ENTL-03","flug":"XA 101","arbeit":"Entladen","mitarbeiter":"MA-03","start":"05:45","ende":"06:05"},
      "XA101-ENTL-04": {"kennung":"XA101-ENTL-04","flug":"XA 101","arbeit":"Entladen","mitarbeiter":"MA-04","start":"05:45","ende":"06:05"},
      "XA101-BELA-01": {"kennung":"XA101-BELA-01","flug":"XA 101","arbeit":"Beladen","mitarbeiter":"MA-01","start":"06:10","ende":"06:30"},
      "XA101-BELA-02": {"kennung":"XA101-BELA-02","flug":"XA 101","arbeit":"Beladen","mitarbeiter":"MA-02","start":"06:10","ende":"06:30"},
      "XA101-BELA-03": {"kennung":"XA101-BELA-03","flug":"XA 101","arbeit":"Beladen","mitarbeiter":"MA-03","start":"06:10","ende":"06:30"},
      "XA101-BELA-04": {"kennung":"XA101-BELA-04","flug":"XA 101","arbeit":"Beladen","mitarbeiter":"MA-04","start":"06:10","ende":"06:30"},
      "XA101-FAEK-01": {"kennung":"XA101-FAEK-01","flug":"XA 101","arbeit":"Fäkalien entleeren","mitarbeiter":"MA-30","start":"05:50","ende":"06:10"},
      "XA101-TANK-01": {"kennung":"XA101-TANK-01","flug":"XA 101","arbeit":"Betanken","mitarbeiter":"MA-20","start":"05:55","ende":"06:20"},
      "XA101-CLEAN-01": {"kennung":"XA101-CLEAN-01","flug":"XA 101","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-40","start":"06:00","ende":"06:30"},
      "XA101-CLEAN-02": {"kennung":"XA101-CLEAN-02","flug":"XA 101","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-41","start":"06:00","ende":"06:30"},
      "XB214-ENTL-01": {"kennung":"XB214-ENTL-01","flug":"XB 214","arbeit":"Entladen","mitarbeiter":"MA-05","start":"06:15","ende":"06:35"},
      "XB214-ENTL-02": {"kennung":"XB214-ENTL-02","flug":"XB 214","arbeit":"Entladen","mitarbeiter":"MA-06","start":"06:15","ende":"06:35"},
      "XB214-ENTL-03": {"kennung":"XB214-ENTL-03","flug":"XB 214","arbeit":"Entladen","mitarbeiter":"MA-07","start":"06:15","ende":"06:35"},
      "XB214-ENTL-04": {"kennung":"XB214-ENTL-04","flug":"XB 214","arbeit":"Entladen","mitarbeiter":"MA-08","start":"06:15","ende":"06:35"},
      "XB214-BELA-01": {"kennung":"XB214-BELA-01","flug":"XB 214","arbeit":"Beladen","mitarbeiter":"MA-05","start":"06:35","ende":"06:55"},
      "XB214-BELA-02": {"kennung":"XB214-BELA-02","flug":"XB 214","arbeit":"Beladen","mitarbeiter":"MA-06","start":"06:35","ende":"06:55"},
      "XB214-BELA-03": {"kennung":"XB214-BELA-03","flug":"XB 214","arbeit":"Beladen","mitarbeiter":"MA-07","start":"06:35","ende":"06:55"},
      "XB214-BELA-04": {"kennung":"XB214-BELA-04","flug":"XB 214","arbeit":"Beladen","mitarbeiter":"MA-08","start":"06:35","ende":"06:55"},
      "XB214-FAEK-01": {"kennung":"XB214-FAEK-01","flug":"XB 214","arbeit":"Fäkalien entleeren","mitarbeiter":"MA-31","start":"06:20","ende":"06:40"},
      "XB214-TANK-01": {"kennung":"XB214-TANK-01","flug":"XB 214","arbeit":"Betanken","mitarbeiter":"MA-21","start":"06:25","ende":"06:50"},
      "XB214-CLEAN-01": {"kennung":"XB214-CLEAN-01","flug":"XB 214","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-42","start":"06:30","ende":"07:00"},
      "XB214-CLEAN-02": {"kennung":"XB214-CLEAN-02","flug":"XB 214","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-43","start":"06:30","ende":"07:00"},
      "XA337-ENTL-01": {"kennung":"XA337-ENTL-01","flug":"XA 337","arbeit":"Entladen","mitarbeiter":"MA-09","start":"06:40","ende":"07:00"},
      "XA337-ENTL-02": {"kennung":"XA337-ENTL-02","flug":"XA 337","arbeit":"Entladen","mitarbeiter":"MA-10","start":"06:40","ende":"07:00"},
      "XA337-ENTL-03": {"kennung":"XA337-ENTL-03","flug":"XA 337","arbeit":"Entladen","mitarbeiter":"MA-11","start":"06:40","ende":"07:00"},
      "XA337-ENTL-04": {"kennung":"XA337-ENTL-04","flug":"XA 337","arbeit":"Entladen","mitarbeiter":"MA-12","start":"06:40","ende":"07:00"},
      "XA337-BELA-01": {"kennung":"XA337-BELA-01","flug":"XA 337","arbeit":"Beladen","mitarbeiter":"MA-09","start":"07:15","ende":"07:35"},
      "XA337-BELA-02": {"kennung":"XA337-BELA-02","flug":"XA 337","arbeit":"Beladen","mitarbeiter":"MA-10","start":"07:15","ende":"07:35"},
      "XA337-BELA-03": {"kennung":"XA337-BELA-03","flug":"XA 337","arbeit":"Beladen","mitarbeiter":"MA-11","start":"07:15","ende":"07:35"},
      "XA337-BELA-04": {"kennung":"XA337-BELA-04","flug":"XA 337","arbeit":"Beladen","mitarbeiter":"MA-12","start":"07:15","ende":"07:35"},
      "XA337-FAEK-01": {"kennung":"XA337-FAEK-01","flug":"XA 337","arbeit":"Fäkalien entleeren","mitarbeiter":"MA-22","start":"06:45","ende":"07:05"},
      "XA337-TANK-01": {"kennung":"XA337-TANK-01","flug":"XA 337","arbeit":"Betanken","mitarbeiter":"MA-22","start":"06:50","ende":"07:15"},
      "XA337-CLEAN-01": {"kennung":"XA337-CLEAN-01","flug":"XA 337","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-40","start":"06:55","ende":"07:25"},
      "XA337-CLEAN-02": {"kennung":"XA337-CLEAN-02","flug":"XA 337","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-41","start":"06:55","ende":"07:25"},
      "XC508-ENTL-01": {"kennung":"XC508-ENTL-01","flug":"XC 508","arbeit":"Entladen","mitarbeiter":"MA-01","start":"07:10","ende":"07:30"},
      "XC508-ENTL-02": {"kennung":"XC508-ENTL-02","flug":"XC 508","arbeit":"Entladen","mitarbeiter":"MA-02","start":"07:10","ende":"07:30"},
      "XC508-ENTL-03": {"kennung":"XC508-ENTL-03","flug":"XC 508","arbeit":"Entladen","mitarbeiter":"MA-03","start":"07:10","ende":"07:30"},
      "XC508-ENTL-04": {"kennung":"XC508-ENTL-04","flug":"XC 508","arbeit":"Entladen","mitarbeiter":"MA-04","start":"07:10","ende":"07:30"},
      "XC508-BELA-01": {"kennung":"XC508-BELA-01","flug":"XC 508","arbeit":"Beladen","mitarbeiter":"MA-01","start":"07:25","ende":"07:45"},
      "XC508-BELA-02": {"kennung":"XC508-BELA-02","flug":"XC 508","arbeit":"Beladen","mitarbeiter":"MA-02","start":"07:25","ende":"07:45"},
      "XC508-BELA-03": {"kennung":"XC508-BELA-03","flug":"XC 508","arbeit":"Beladen","mitarbeiter":"MA-03","start":"07:25","ende":"07:45"},
      "XC508-BELA-04": {"kennung":"XC508-BELA-04","flug":"XC 508","arbeit":"Beladen","mitarbeiter":"MA-04","start":"07:25","ende":"07:45"},
      "XC508-FAEK-01": {"kennung":"XC508-FAEK-01","flug":"XC 508","arbeit":"Fäkalien entleeren","mitarbeiter":"MA-30","start":"07:15","ende":"07:35"},
      "XC508-TANK-01": {"kennung":"XC508-TANK-01","flug":"XC 508","arbeit":"Betanken","mitarbeiter":"MA-20","start":"07:20","ende":"07:45"},
      "XC508-CLEAN-01": {"kennung":"XC508-CLEAN-01","flug":"XC 508","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-42","start":"07:25","ende":"07:50"},
      "XB622-ENTL-01": {"kennung":"XB622-ENTL-01","flug":"XB 622","arbeit":"Entladen","mitarbeiter":"MA-05","start":"07:45","ende":"08:05"},
      "XB622-ENTL-02": {"kennung":"XB622-ENTL-02","flug":"XB 622","arbeit":"Entladen","mitarbeiter":"MA-06","start":"07:45","ende":"08:05"},
      "XB622-ENTL-03": {"kennung":"XB622-ENTL-03","flug":"XB 622","arbeit":"Entladen","mitarbeiter":"MA-07","start":"07:45","ende":"08:05"},
      "XB622-ENTL-04": {"kennung":"XB622-ENTL-04","flug":"XB 622","arbeit":"Entladen","mitarbeiter":"MA-08","start":"07:45","ende":"08:05"},
      "XB622-BELA-01": {"kennung":"XB622-BELA-01","flug":"XB 622","arbeit":"Beladen","mitarbeiter":"MA-05","start":"08:15","ende":"08:35"},
      "XB622-BELA-02": {"kennung":"XB622-BELA-02","flug":"XB 622","arbeit":"Beladen","mitarbeiter":"MA-06","start":"08:15","ende":"08:35"},
      "XB622-BELA-03": {"kennung":"XB622-BELA-03","flug":"XB 622","arbeit":"Beladen","mitarbeiter":"MA-07","start":"08:15","ende":"08:35"},
      "XB622-BELA-04": {"kennung":"XB622-BELA-04","flug":"XB 622","arbeit":"Beladen","mitarbeiter":"MA-08","start":"08:15","ende":"08:35"},
      "XB622-FAEK-01": {"kennung":"XB622-FAEK-01","flug":"XB 622","arbeit":"Fäkalien entleeren","mitarbeiter":"MA-31","start":"07:50","ende":"08:10"},
      "XB622-TANK-01": {"kennung":"XB622-TANK-01","flug":"XB 622","arbeit":"Betanken","mitarbeiter":"MA-21","start":"07:55","ende":"08:20"},
      "XB622-CLEAN-01": {"kennung":"XB622-CLEAN-01","flug":"XB 622","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-40","start":"08:00","ende":"08:30"},
      "XB622-CLEAN-02": {"kennung":"XB622-CLEAN-02","flug":"XB 622","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-41","start":"08:00","ende":"08:30"},
      "XA745-ENTL-01": {"kennung":"XA745-ENTL-01","flug":"XA 745","arbeit":"Entladen","mitarbeiter":"MA-09","start":"08:20","ende":"08:40"},
      "XA745-ENTL-02": {"kennung":"XA745-ENTL-02","flug":"XA 745","arbeit":"Entladen","mitarbeiter":"MA-10","start":"08:20","ende":"08:40"},
      "XA745-ENTL-03": {"kennung":"XA745-ENTL-03","flug":"XA 745","arbeit":"Entladen","mitarbeiter":"MA-11","start":"08:20","ende":"08:40"},
      "XA745-ENTL-04": {"kennung":"XA745-ENTL-04","flug":"XA 745","arbeit":"Entladen","mitarbeiter":"MA-12","start":"08:20","ende":"08:40"},
      "XA745-BELA-01": {"kennung":"XA745-BELA-01","flug":"XA 745","arbeit":"Beladen","mitarbeiter":"MA-09","start":"09:00","ende":"09:20"},
      "XA745-BELA-02": {"kennung":"XA745-BELA-02","flug":"XA 745","arbeit":"Beladen","mitarbeiter":"MA-10","start":"09:00","ende":"09:20"},
      "XA745-BELA-03": {"kennung":"XA745-BELA-03","flug":"XA 745","arbeit":"Beladen","mitarbeiter":"MA-11","start":"09:00","ende":"09:20"},
      "XA745-BELA-04": {"kennung":"XA745-BELA-04","flug":"XA 745","arbeit":"Beladen","mitarbeiter":"MA-12","start":"09:00","ende":"09:20"},
      "XA745-FAEK-01": {"kennung":"XA745-FAEK-01","flug":"XA 745","arbeit":"Fäkalien entleeren","mitarbeiter":"MA-22","start":"08:25","ende":"08:45"},
      "XA745-TANK-01": {"kennung":"XA745-TANK-01","flug":"XA 745","arbeit":"Betanken","mitarbeiter":"MA-22","start":"08:30","ende":"08:55"},
      "XA745-CLEAN-01": {"kennung":"XA745-CLEAN-01","flug":"XA 745","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-42","start":"08:35","ende":"09:05"},
      "XA745-CLEAN-02": {"kennung":"XA745-CLEAN-02","flug":"XA 745","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-43","start":"08:35","ende":"09:05"},
      "XA745-CLEAN-03": {"kennung":"XA745-CLEAN-03","flug":"XA 745","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-40","start":"08:35","ende":"09:05"},
      "XC810-ENTL-01": {"kennung":"XC810-ENTL-01","flug":"XC 810","arbeit":"Entladen","mitarbeiter":"MA-01","start":"08:55","ende":"09:15"},
      "XC810-ENTL-02": {"kennung":"XC810-ENTL-02","flug":"XC 810","arbeit":"Entladen","mitarbeiter":"MA-02","start":"08:55","ende":"09:15"},
      "XC810-ENTL-03": {"kennung":"XC810-ENTL-03","flug":"XC 810","arbeit":"Entladen","mitarbeiter":"MA-03","start":"08:55","ende":"09:15"},
      "XC810-ENTL-04": {"kennung":"XC810-ENTL-04","flug":"XC 810","arbeit":"Entladen","mitarbeiter":"MA-04","start":"08:55","ende":"09:15"},
      "XC810-BELA-01": {"kennung":"XC810-BELA-01","flug":"XC 810","arbeit":"Beladen","mitarbeiter":"MA-01","start":"09:15","ende":"09:35"},
      "XC810-BELA-02": {"kennung":"XC810-BELA-02","flug":"XC 810","arbeit":"Beladen","mitarbeiter":"MA-02","start":"09:15","ende":"09:35"},
      "XC810-BELA-03": {"kennung":"XC810-BELA-03","flug":"XC 810","arbeit":"Beladen","mitarbeiter":"MA-03","start":"09:15","ende":"09:35"},
      "XC810-BELA-04": {"kennung":"XC810-BELA-04","flug":"XC 810","arbeit":"Beladen","mitarbeiter":"MA-04","start":"09:15","ende":"09:35"},
      "XC810-FAEK-01": {"kennung":"XC810-FAEK-01","flug":"XC 810","arbeit":"Fäkalien entleeren","mitarbeiter":"MA-30","start":"09:00","ende":"09:20"},
      "XC810-TANK-01": {"kennung":"XC810-TANK-01","flug":"XC 810","arbeit":"Betanken","mitarbeiter":"MA-20","start":"09:05","ende":"09:30"},
      "XC810-CLEAN-01": {"kennung":"XC810-CLEAN-01","flug":"XC 810","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-40","start":"09:10","ende":"09:40"},
      "XB933-ENTL-01": {"kennung":"XB933-ENTL-01","flug":"XB 933","arbeit":"Entladen","mitarbeiter":"MA-05","start":"09:30","ende":"09:50"},
      "XB933-ENTL-02": {"kennung":"XB933-ENTL-02","flug":"XB 933","arbeit":"Entladen","mitarbeiter":"MA-06","start":"09:30","ende":"09:50"},
      "XB933-ENTL-03": {"kennung":"XB933-ENTL-03","flug":"XB 933","arbeit":"Entladen","mitarbeiter":"MA-07","start":"09:30","ende":"09:50"},
      "XB933-ENTL-04": {"kennung":"XB933-ENTL-04","flug":"XB 933","arbeit":"Entladen","mitarbeiter":"MA-08","start":"09:30","ende":"09:50"},
      "XB933-BELA-01": {"kennung":"XB933-BELA-01","flug":"XB 933","arbeit":"Beladen","mitarbeiter":"MA-05","start":"10:00","ende":"10:20"},
      "XB933-BELA-02": {"kennung":"XB933-BELA-02","flug":"XB 933","arbeit":"Beladen","mitarbeiter":"MA-06","start":"10:00","ende":"10:20"},
      "XB933-BELA-03": {"kennung":"XB933-BELA-03","flug":"XB 933","arbeit":"Beladen","mitarbeiter":"MA-07","start":"10:00","ende":"10:20"},
      "XB933-BELA-04": {"kennung":"XB933-BELA-04","flug":"XB 933","arbeit":"Beladen","mitarbeiter":"MA-08","start":"10:00","ende":"10:20"},
      "XB933-FAEK-01": {"kennung":"XB933-FAEK-01","flug":"XB 933","arbeit":"Fäkalien entleeren","mitarbeiter":"MA-31","start":"09:35","ende":"09:55"},
      "XB933-TANK-01": {"kennung":"XB933-TANK-01","flug":"XB 933","arbeit":"Betanken","mitarbeiter":"MA-21","start":"09:40","ende":"10:05"},
      "XB933-CLEAN-01": {"kennung":"XB933-CLEAN-01","flug":"XB 933","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-42","start":"09:45","ende":"10:15"},
      "XB933-CLEAN-02": {"kennung":"XB933-CLEAN-02","flug":"XB 933","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-43","start":"09:45","ende":"10:15"},
      "XB933-CLEAN-03": {"kennung":"XB933-CLEAN-03","flug":"XB 933","arbeit":"Innenraum-Cleaning","mitarbeiter":"MA-40","start":"09:45","ende":"10:15"}
    }
  },

  /* Datenmodell (Auftrag 005, Stufe 2): Objektarten mit Status und erlaubten Übergängen, den Ereignissen
     je Art und den Fristen, deren Ablauf die Uhr meldet. Die Hülle führt den Status danach; die Worte
     kommen von hier, die Hülle selbst kennt kein Fachgebiet.
     - status.werte: Status und wie der Disponent ihn nennt; der erste ist der gewöhnliche Fall.
     - status.uebergaenge: wohin es von einem Status aus gehen darf; alles andere verweigert die Hülle.
     - status.durch: Ereignis, das den Status setzt (Meldung Onblock → Am Block).
     - status.zuBeginn: Status zu Tagesbeginn, aus der Uhrzeit.
     - fristen: Steht ein Objekt zur Zeit in feld noch im Status, sendet die Uhr das Ereignis aktion. */
  arten: {
    auftraege: {
      name: "Auftrag", einen: "einen Auftrag", bei: "bei einem Auftrag",
      nennung: function (o) { return o.flug + " " + o.arbeit; },
      status: {
        werte: { offen: "Offen", begonnen: "Begonnen", fertig: "Fertig" },
        uebergaenge: { offen: ["begonnen", "fertig"], begonnen: ["fertig"], fertig: [] },
        /* Dein Wunsch vom 07.11. (wunsch-022): vorbei = Fertig, läuft gerade = Begonnen, sonst Offen. */
        zuBeginn: function (o, jetzt, h) {
          if (h.minuten(o.ende) <= jetzt) return "fertig";
          if (h.minuten(o.start) <= jetzt) return "begonnen";
          return "offen";
        }
      },
      ereignisse: { umplanen: "Umplanen", verschieben: "Verschieben", zeitaendern: "Zeit ändern",
        zuruecklegen: "Zurücklegen in die Liste" }
    },
    fluege: {
      name: "Flug", einen: "einen Flug", bei: "bei einem Flug",
      nennung: function (o) { return o.flug; },
      status: {
        werte: { erwartet: "Erwartet", amBlock: "Am Block", abgefertigt: "Abgefertigt" },
        uebergaenge: { erwartet: ["amBlock"], amBlock: ["abgefertigt"], abgefertigt: [] },
        durch: { onblock: "amBlock", offblock: "abgefertigt" },
        zuBeginn: function (o, jetzt, h) {
          if (h.minuten(o.offBlock) <= jetzt) return "abgefertigt";
          if (h.minuten(o.onBlock) <= jetzt) return "amBlock";
          return "erwartet";
        }
      },
      fristen: [{
        status: "erwartet", feld: "onBlock", aktion: "ohneOnblock",
        fall: "Ein Flug ist zur geplanten Onblock-Zeit noch nicht am Block",
        satz: function (o) { return o.flug + " ist um " + o.onBlock + " noch nicht am Block"; }
      }],
      ereignisse: { onblock: "Onblock", offblock: "Offblock", verspaetung: "Flugverspätung" }
    },
    mitarbeiter: {
      name: "Mitarbeiter", einen: "einen Mitarbeiter", bei: "bei einem Mitarbeiter",
      nennung: function (o) { return o.name; },
      ereignisse: { krankmeldung: "Krankmeldung" }
    }
  },

  /* Gemockte Meldungen vom Vorfeld: Onblock und Offblock kommen zur Zeit, die gerade im Flug steht.
     XB 933 kommt heute 20 Minuten später an Block als geplant, ohne Verspätungsmeldung vorher. */
  meldungen: function (zeit, h) {
    var SPAETER = { XB933: 20 }, out = [], fluege = h.lies("fluege") || {};
    Object.keys(fluege).sort().forEach(function (id) {
      var f = fluege[id], plus = SPAETER[id] || 0;
      if (h.zeit(h.minuten(f.onBlock) + plus) === zeit) {
        out.push({ objekt: "fluege/" + id, aktion: "onblock", erzaehlung: f.flug + " ist am Block" });
      }
      if (h.zeit(h.minuten(f.offBlock) + plus) === zeit) {
        out.push({ objekt: "fluege/" + id, aktion: "offblock", erzaehlung: f.flug + " ist vom Block" });
      }
    });
    return out;
  }
});
